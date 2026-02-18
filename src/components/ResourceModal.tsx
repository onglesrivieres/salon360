import React, { useState, useEffect, lazy, Suspense } from "react";
import { Drawer } from "./ui/Drawer";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useToast } from "./ui/Toast";
import {
  supabase,
  Resource,
  ResourceCategory,
  ResourceSubcategory,
  ResourcePhotoWithUrl,
} from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useSettings } from "../contexts/SettingsContext";
import { Image, ExternalLink, Plus, ChevronDown, Star } from "lucide-react";
import {
  CATEGORY_COLORS,
  getCategoryBadgeClasses,
} from "../lib/category-colors";
import { compressImage } from "../lib/image-utils";
import { PhotoUpload } from "./photos/PhotoUpload";
import { PhotoThumbnail } from "./photos/PhotoThumbnail";
import { PendingPhoto } from "./photos/useTicketPhotos";
import { getStorageService } from "../lib/storage";

const LazyRichTextEditor = lazy(() =>
  import("./RichTextEditor").then((m) => ({ default: m.RichTextEditor })),
);

const MAX_PHOTOS = 3;
const MAX_FILE_SIZE_MB = 5;

interface ResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  resource?: Resource | null;
  category: ResourceCategory;
  storeId: string;
  subcategories: ResourceSubcategory[];
  onCategoriesChanged: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  sop: "Standard Operating Procedure",
  employee_manual: "Employee Manual",
  training: "Training",
  policy: "Policy",
  rules: "Rules",
};

export function ResourceModal({
  isOpen,
  onClose,
  onSuccess,
  resource,
  category,
  storeId,
  subcategories,
  onCategoriesChanged,
}: ResourceModalProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const { getStorageConfig } = useSettings();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    description_text: "",
    link_url: "",
    thumbnail_url: "",
    subcategory: "",
  });

  // New category creation state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("blue");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Photo state
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ResourcePhotoWithUrl[]>(
    [],
  );
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [thumbnailPhotoId, setThumbnailPhotoId] = useState<string | null>(null);

  useEffect(() => {
    if (resource && isOpen) {
      setFormData({
        title: resource.title,
        description: resource.description || "",
        description_text: resource.description_text || "",
        link_url: resource.link_url || "",
        thumbnail_url: resource.thumbnail_url || "",
        subcategory: resource.subcategory || "",
      });
      loadExistingPhotos(resource.id, resource.thumbnail_url);
    } else if (!resource && isOpen) {
      setFormData({
        title: "",
        description: "",
        description_text: "",
        link_url: "",
        thumbnail_url: "",
        subcategory: "",
      });
      setExistingPhotos([]);
      setPhotosToDelete([]);
      setThumbnailPhotoId(null);
    }
    setPendingPhotos([]);
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryColor("blue");
  }, [resource, isOpen]);

  async function loadExistingPhotos(
    resourceId: string,
    currentThumbnailUrl: string | null,
  ) {
    const storageConfig = getStorageConfig();
    if (!storageConfig?.r2Config?.publicUrl) {
      setExistingPhotos([]);
      return;
    }

    const { data, error } = await supabase
      .from("resource_photos")
      .select("*")
      .eq("resource_id", resourceId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error loading resource photos:", error);
      setExistingPhotos([]);
      return;
    }

    const publicUrl = storageConfig.r2Config.publicUrl.replace(/\/$/, "");
    const photosWithUrls: ResourcePhotoWithUrl[] = (data || []).map(
      (photo) => ({
        ...photo,
        url: `${publicUrl}/${photo.storage_path}`,
      }),
    );

    setExistingPhotos(photosWithUrls);

    // Check if current thumbnail matches an existing photo URL
    if (currentThumbnailUrl) {
      const matchingPhoto = photosWithUrls.find(
        (p) => p.url === currentThumbnailUrl,
      );
      if (matchingPhoto) {
        setThumbnailPhotoId(matchingPhoto.id);
      }
    }
  }

  function handleClose() {
    // Revoke pending photo blob URLs
    pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPendingPhotos([]);
    setExistingPhotos([]);
    setPhotosToDelete([]);
    setThumbnailPhotoId(null);
    setIsProcessingPhoto(false);
    setFormData({
      title: "",
      description: "",
      description_text: "",
      link_url: "",
      thumbnail_url: "",
      subcategory: "",
    });
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryColor("blue");
    onClose();
  }

  async function handlePhotoSelect(file: File) {
    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast("Please select a JPEG, PNG, or WebP image", "error");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      showToast(`File size must be under ${MAX_FILE_SIZE_MB}MB`, "error");
      return;
    }

    // Check total count
    const totalPhotos =
      existingPhotos.length - photosToDelete.length + pendingPhotos.length;
    if (totalPhotos >= MAX_PHOTOS) {
      showToast(`Maximum ${MAX_PHOTOS} photos allowed`, "error");
      return;
    }

    try {
      setIsProcessingPhoto(true);
      const compressedBlob = await compressImage(file);
      const previewUrl = URL.createObjectURL(compressedBlob);
      const newPhoto: PendingPhoto = {
        id: crypto.randomUUID(),
        file,
        compressedBlob,
        previewUrl,
        filename: file.name,
      };
      setPendingPhotos((prev) => [...prev, newPhoto]);
    } catch (error) {
      console.error("Error compressing photo:", error);
      showToast("Failed to process photo", "error");
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  function handleRemovePhoto(photoId: string) {
    // Check if it's a pending photo
    const pendingIndex = pendingPhotos.findIndex((p) => p.id === photoId);
    if (pendingIndex >= 0) {
      URL.revokeObjectURL(pendingPhotos[pendingIndex].previewUrl);
      setPendingPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else {
      // It's an existing photo — mark for deletion
      setPhotosToDelete((prev) => [...prev, photoId]);
    }

    // Clear thumbnail selection if removed photo was the thumbnail
    if (thumbnailPhotoId === photoId) {
      setThumbnailPhotoId(null);
    }
  }

  function handleSetAsThumbnail(photoId: string) {
    if (thumbnailPhotoId === photoId) {
      // Toggle off
      setThumbnailPhotoId(null);
    } else {
      setThumbnailPhotoId(photoId);
      // Clear the manual URL field when selecting an uploaded photo
      setFormData((prev) => ({ ...prev, thumbnail_url: "" }));
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      showToast("Please enter a category name", "error");
      return;
    }

    // Check for duplicate
    const exists = subcategories.some(
      (c) => c.name.toLowerCase() === newCategoryName.trim().toLowerCase(),
    );
    if (exists) {
      showToast("A category with this name already exists", "error");
      return;
    }

    try {
      setCreatingCategory(true);

      // Get max display_order
      const { data: maxOrderData } = await supabase
        .from("resource_categories")
        .select("display_order")
        .eq("store_id", storeId)
        .eq("tab", category)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newDisplayOrder = (maxOrderData?.display_order ?? -1) + 1;

      const { error } = await supabase.from("resource_categories").insert({
        store_id: storeId,
        tab: category,
        name: newCategoryName.trim(),
        color: newCategoryColor,
        display_order: newDisplayOrder,
        is_active: true,
      });

      if (error) throw error;

      showToast("Category created successfully", "success");
      setFormData({ ...formData, subcategory: newCategoryName.trim() });
      setShowNewCategory(false);
      setNewCategoryName("");
      setNewCategoryColor("blue");
      onCategoriesChanged();
    } catch (error: any) {
      console.error("Error creating category:", error);
      if (error.code === "23505") {
        showToast("A category with this name already exists", "error");
      } else {
        showToast("Failed to create category", "error");
      }
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title.trim()) {
      showToast("Please enter a title", "error");
      return;
    }

    if (formData.title.trim().length < 2) {
      showToast("Title must be at least 2 characters", "error");
      return;
    }

    // Validate URL format if provided
    if (formData.link_url.trim()) {
      try {
        new URL(formData.link_url.trim());
      } catch {
        showToast(
          "Please enter a valid URL (e.g., https://example.com)",
          "error",
        );
        return;
      }
    }

    // Validate thumbnail URL format if provided (and no uploaded photo selected)
    if (formData.thumbnail_url.trim() && !thumbnailPhotoId) {
      try {
        new URL(formData.thumbnail_url.trim());
      } catch {
        showToast("Please enter a valid thumbnail URL", "error");
        return;
      }
    }

    try {
      setSaving(true);

      const hasThumbnailUrl = !!formData.thumbnail_url.trim();
      const thumbnailSource =
        thumbnailPhotoId || hasThumbnailUrl ? "manual" : "none";

      let resourceId: string;

      if (resource) {
        // Update existing resource
        const { error: updateError } = await supabase
          .from("resources")
          .update({
            title: formData.title.trim(),
            description: formData.description || null,
            description_text: formData.description_text.trim() || null,
            link_url: formData.link_url.trim() || null,
            thumbnail_url: thumbnailPhotoId
              ? null
              : formData.thumbnail_url.trim() || null,
            thumbnail_source: thumbnailSource,
            subcategory: formData.subcategory || null,
            updated_by: session?.employee_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", resource.id);

        if (updateError) throw updateError;
        resourceId = resource.id;
      } else {
        // Get the max display_order for this category in this store
        const { data: maxOrderData } = await supabase
          .from("resources")
          .select("display_order")
          .eq("store_id", storeId)
          .eq("category", category)
          .order("display_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const newDisplayOrder = (maxOrderData?.display_order ?? -1) + 1;

        // Create new resource — return ID for photo uploads
        const { data: insertedResource, error: insertError } = await supabase
          .from("resources")
          .insert({
            store_id: storeId,
            category: category,
            subcategory: formData.subcategory || null,
            title: formData.title.trim(),
            description: formData.description || null,
            description_text: formData.description_text.trim() || null,
            link_url: formData.link_url.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            thumbnail_source: thumbnailSource,
            display_order: newDisplayOrder,
            is_active: true,
            created_by: session?.employee_id || null,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        resourceId = insertedResource.id;
      }

      // Handle photo operations
      await handlePhotoOperations(resourceId);

      showToast(
        resource
          ? "Resource updated successfully"
          : "Resource added successfully",
        "success",
      );
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Error saving resource:", error);

      if (error.code === "42501") {
        showToast(
          "Permission denied. Only Admins, Managers, and Owners can manage resources.",
          "error",
        );
      } else if (error.message) {
        showToast(`Error: ${error.message}`, "error");
      } else {
        showToast("Failed to save resource", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoOperations(resourceId: string) {
    const storageConfig = getStorageConfig();
    if (!storageConfig?.r2Config?.publicUrl) {
      // R2 not configured — skip photo operations silently
      return;
    }

    const storage = getStorageService(storageConfig);
    const publicUrl = storageConfig.r2Config.publicUrl.replace(/\/$/, "");

    // 1. Delete removed photos
    for (const photoId of photosToDelete) {
      const photo = existingPhotos.find((p) => p.id === photoId);
      if (photo) {
        await storage.delete(photo.storage_path);
        await supabase.from("resource_photos").delete().eq("id", photoId);
      }
    }

    // 2. Upload new photos
    const uploadedPhotoUrls = new Map<string, string>(); // pendingId -> url
    for (let i = 0; i < pendingPhotos.length; i++) {
      const pending = pendingPhotos[i];
      const timestamp = Date.now();
      const uuid = crypto.randomUUID();
      const storagePath = `resources/${storeId}/${resourceId}/${timestamp}_${uuid}.jpg`;

      const uploadResult = await storage.upload(
        storagePath,
        pending.compressedBlob,
        {
          contentType: "image/jpeg",
        },
      );

      if (!uploadResult.success) {
        console.error("Failed to upload photo:", uploadResult.error);
        continue;
      }

      const { error: insertError } = await supabase
        .from("resource_photos")
        .insert({
          store_id: storeId,
          resource_id: resourceId,
          storage_path: storagePath,
          filename: pending.filename,
          file_size: pending.compressedBlob.size,
          mime_type: "image/jpeg",
          display_order: existingPhotos.length - photosToDelete.length + i,
          uploaded_by: session?.employee_id,
        });

      if (insertError) {
        console.error("Failed to save photo metadata:", insertError);
        continue;
      }

      uploadedPhotoUrls.set(pending.id, `${publicUrl}/${storagePath}`);
    }

    // 3. Set thumbnail if a photo is selected
    if (thumbnailPhotoId) {
      let thumbnailUrl: string | null = null;

      // Check pending photos first
      const pendingUrl = uploadedPhotoUrls.get(thumbnailPhotoId);
      if (pendingUrl) {
        thumbnailUrl = pendingUrl;
      } else {
        // Check existing photos (not marked for deletion)
        const existingPhoto = existingPhotos.find(
          (p) => p.id === thumbnailPhotoId && !photosToDelete.includes(p.id),
        );
        if (existingPhoto) {
          thumbnailUrl = existingPhoto.url;
        }
      }

      if (thumbnailUrl) {
        await supabase
          .from("resources")
          .update({
            thumbnail_url: thumbnailUrl,
            thumbnail_source: "manual",
          })
          .eq("id", resourceId);
      }
    }
  }

  // Compute visible photos (existing minus deleted, plus pending)
  const visibleExistingPhotos = existingPhotos.filter(
    (p) => !photosToDelete.includes(p.id),
  );
  const totalPhotoCount = visibleExistingPhotos.length + pendingPhotos.length;
  const remainingSlots = MAX_PHOTOS - totalPhotoCount;

  // Get active subcategories sorted by display_order
  const activeSubcategories = subcategories
    .filter((c) => c.is_active)
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={
        resource
          ? "Edit Resource"
          : `Add ${CATEGORY_LABELS[category] || "Resource"}`
      }
      size="lg"
      footer={
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1"
          >
            {saving
              ? "Saving..."
              : resource
                ? "Update Resource"
                : "Add Resource"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="e.g., Opening Procedures Checklist"
            required
            autoFocus
          />
        </div>

        {/* Subcategory Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          {!showNewCategory ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={formData.subcategory}
                  onChange={(e) =>
                    setFormData({ ...formData, subcategory: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-10"
                >
                  <option value="">Uncategorized</option>
                  {activeSubcategories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1"
                title="Add new category"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  New Category
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName("");
                    setNewCategoryColor("blue");
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                autoFocus
              />
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color.key}
                      type="button"
                      onClick={() => setNewCategoryColor(color.key)}
                      className={`px-3 py-1 text-xs rounded-full border-2 transition-all ${getCategoryBadgeClasses(color.key)} ${
                        newCategoryColor === color.key
                          ? "border-gray-800 ring-2 ring-offset-1 ring-gray-400"
                          : "border-transparent"
                      }`}
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
                size="sm"
                className="w-full"
              >
                {creatingCategory ? "Creating..." : "Create Category"}
              </Button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Organize resources into categories for easier navigation
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <Suspense
            fallback={
              <div className="h-[180px] border border-gray-300 rounded-lg bg-gray-50 animate-pulse" />
            }
          >
            <LazyRichTextEditor
              content={formData.description}
              onChange={(html, text) =>
                setFormData((prev) => ({
                  ...prev,
                  description: html,
                  description_text: text,
                }))
              }
              storeId={storeId}
              placeholder="Brief description of this resource (optional)"
            />
          </Suspense>
        </div>

        {/* Photos Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos{" "}
            <span className="text-gray-400 font-normal">
              ({totalPhotoCount}/{MAX_PHOTOS})
            </span>
          </label>

          {/* Photo grid */}
          {totalPhotoCount > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {/* Existing photos */}
              {visibleExistingPhotos.map((photo) => (
                <div key={photo.id} className="relative">
                  <PhotoThumbnail
                    photo={photo}
                    canDelete
                    onDelete={() => handleRemovePhoto(photo.id)}
                    size="sm"
                  />
                  {/* Thumbnail star button */}
                  <button
                    type="button"
                    onClick={() => handleSetAsThumbnail(photo.id)}
                    className={`absolute bottom-1 left-1 p-0.5 rounded-full transition-colors ${
                      thumbnailPhotoId === photo.id
                        ? "bg-amber-400 text-white"
                        : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white"
                    }`}
                    title={
                      thumbnailPhotoId === photo.id
                        ? "Remove as thumbnail"
                        : "Use as thumbnail"
                    }
                  >
                    <Star
                      className="w-3 h-3"
                      fill={
                        thumbnailPhotoId === photo.id ? "currentColor" : "none"
                      }
                    />
                  </button>
                  {thumbnailPhotoId === photo.id && (
                    <span className="absolute -bottom-4 left-0 right-0 text-[10px] text-amber-600 text-center font-medium">
                      Thumbnail
                    </span>
                  )}
                </div>
              ))}

              {/* Pending photos */}
              {pendingPhotos.map((photo) => (
                <div key={photo.id} className="relative">
                  <PhotoThumbnail
                    photo={photo}
                    canDelete
                    onDelete={() => handleRemovePhoto(photo.id)}
                    size="sm"
                    isPending
                  />
                  {/* Thumbnail star button */}
                  <button
                    type="button"
                    onClick={() => handleSetAsThumbnail(photo.id)}
                    className={`absolute bottom-1 left-1 p-0.5 rounded-full transition-colors ${
                      thumbnailPhotoId === photo.id
                        ? "bg-amber-400 text-white"
                        : "bg-black/40 text-white/70 hover:bg-black/60 hover:text-white"
                    }`}
                    title={
                      thumbnailPhotoId === photo.id
                        ? "Remove as thumbnail"
                        : "Use as thumbnail"
                    }
                  >
                    <Star
                      className="w-3 h-3"
                      fill={
                        thumbnailPhotoId === photo.id ? "currentColor" : "none"
                      }
                    />
                  </button>
                  {thumbnailPhotoId === photo.id && (
                    <span className="absolute -bottom-4 left-0 right-0 text-[10px] text-amber-600 text-center font-medium">
                      Thumbnail
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload buttons */}
          <PhotoUpload
            onFileSelect={handlePhotoSelect}
            disabled={saving}
            isUploading={isProcessingPhoto}
            remainingSlots={remainingSlots}
          />

          {thumbnailPhotoId && (
            <p className="text-xs text-amber-600 mt-1">
              An uploaded photo is selected as the card thumbnail
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Link URL
          </label>
          <div className="flex gap-2">
            <Input
              value={formData.link_url}
              onChange={(e) =>
                setFormData({ ...formData, link_url: e.target.value })
              }
              placeholder="https://docs.google.com/document/..."
              type="url"
              className="flex-1"
            />
            {formData.link_url && (
              <a
                href={formData.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                title="Open link in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Link to Google Docs, YouTube, or any external resource
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thumbnail URL
          </label>
          <Input
            value={formData.thumbnail_url}
            onChange={(e) => {
              setFormData({ ...formData, thumbnail_url: e.target.value });
              // Clear photo thumbnail selection when typing a URL
              if (e.target.value.trim()) {
                setThumbnailPhotoId(null);
              }
            }}
            placeholder="https://example.com/image.jpg"
            type="url"
            disabled={!!thumbnailPhotoId}
          />
          <p className="text-xs text-gray-500 mt-1">
            {thumbnailPhotoId
              ? "Clear the selected photo thumbnail above to use a URL instead"
              : "Direct link to an image for the card preview (optional)"}
          </p>
        </div>

        {/* Thumbnail Preview — only show for URL thumbnails */}
        {formData.thumbnail_url && !thumbnailPhotoId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preview
            </label>
            <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
              <img
                src={formData.thumbnail_url}
                alt="Thumbnail preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (
                    e.target as HTMLImageElement
                  ).nextElementSibling?.classList.remove("hidden");
                }}
              />
              <div className="hidden absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Image className="w-8 h-8 mx-auto mb-1" />
                  <span className="text-xs">Failed to load image</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
