import { useState, useCallback, useRef } from "react";
import Cropper, { Area } from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EntityAvatar } from "@/components/EntityAvatar";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface ProfilePhotoUploadProps {
  entityId: string;
  entityName: string;
  currentPhotoUrl?: string | null;
  currentThumbUrl?: string | null;
  onPhotoUpdated: (photoUrl: string | null, thumbUrl: string | null) => void;
}

async function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, 400, 400
  );

  // Create thumb canvas
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = 80;
  thumbCanvas.height = 80;
  const thumbCtx = thumbCanvas.getContext("2d")!;
  thumbCtx.drawImage(canvas, 0, 0, 400, 400, 0, 0, 80, 80);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9);
  });
}

async function getCroppedThumb(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 80;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, 80, 80);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85);
  });
}

export function ProfilePhotoUpload({ entityId, entityName, currentPhotoUrl, currentThumbUrl, onPhotoUpdated }: ProfilePhotoUploadProps) {
  const { workspaceId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG, and WEBP files are allowed");
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCropDialogOpen(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleSaveCrop = async () => {
    if (!croppedArea || !imageSrc || !workspaceId) return;

    setUploading(true);
    setProgress(20);

    try {
      // Generate cropped images
      const fullBlob = await getCroppedImg(imageSrc, croppedArea);
      const thumbBlob = await getCroppedThumb(imageSrc, croppedArea);
      setProgress(40);

      const timestamp = Date.now();
      const fullPath = `${workspaceId}/${entityId}/photo_${timestamp}.jpg`;
      const thumbPath = `${workspaceId}/${entityId}/thumb_${timestamp}.jpg`;

      // Upload full photo
      const { error: fullError } = await supabase.storage
        .from("profile-photos")
        .upload(fullPath, fullBlob, { contentType: "image/jpeg", upsert: true });
      if (fullError) throw fullError;
      setProgress(60);

      // Upload thumb
      const { error: thumbError } = await supabase.storage
        .from("profile-photos")
        .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: true });
      if (thumbError) throw thumbError;
      setProgress(80);

      // Get signed URLs (1 year validity)
      const { data: fullUrl } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(fullPath, 365 * 24 * 60 * 60);
      const { data: thumbUrl } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(thumbPath, 365 * 24 * 60 * 60);

      // Update entity
      const { error: updateError } = await supabase.from("entities").update({
        profile_photo_url: fullUrl?.signedUrl || null,
        profile_photo_thumb: thumbUrl?.signedUrl || null,
      } as any).eq("id", entityId);

      if (updateError) throw updateError;
      setProgress(100);

      onPhotoUpdated(fullUrl?.signedUrl || null, thumbUrl?.signedUrl || null);
      toast.success("Profile photo updated");
      setCropDialogOpen(false);
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = async () => {
    if (!workspaceId) return;
    setUploading(true);

    try {
      // List and delete all files in the entity folder
      const { data: files } = await supabase.storage
        .from("profile-photos")
        .list(`${workspaceId}/${entityId}`);

      if (files && files.length > 0) {
        await supabase.storage
          .from("profile-photos")
          .remove(files.map(f => `${workspaceId}/${entityId}/${f.name}`));
      }

      // Clear entity URLs
      await supabase.from("entities").update({
        profile_photo_url: null,
        profile_photo_thumb: null,
      } as any).eq("id", entityId);

      onPhotoUpdated(null, null);
      toast.success("Photo removed");
    } catch (err: any) {
      toast.error("Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <EntityAvatar
          entityId={entityId}
          name={entityName}
          photoUrl={currentPhotoUrl}
          size="xl"
        />
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-background/60 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs mt-1 text-muted-foreground">Processing...</span>
          </div>
        )}
      </div>

      {uploading && progress > 0 && (
        <Progress value={progress} className="w-32 h-1.5" />
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1 h-3.5 w-3.5" /> Upload Photo
        </Button>
        {currentPhotoUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={uploading}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileSelect}
      />

      <Dialog open={cropDialogOpen} onOpenChange={(o) => !uploading && setCropDialogOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Profile Photo</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-80 bg-muted rounded-lg overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCropDialogOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleSaveCrop} disabled={uploading}>
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
