import React, { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useToast } from "./ui/Toast";
import {
  supabase,
  Resource,
  ResourceCategory,
  ResourceSubcategory,
} from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Image, ExternalLink, Plus, ChevronDown } from "lucide-react";
import {
  CATEGORY_COLORS,
  getCategoryBadgeClasses,
} from "../lib/category-colors";

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
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    link_url: "",
    thumbnail_url: "",
    subcategory: "",
  });

  // New category creation state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("blue");
  const [creatingCategory, setCreatingCategory] = useState(false);

  useEffect(() => {
    if (resource && isOpen) {
      setFormData({
        title: resource.title,
        description: resource.description || "",
        link_url: resource.link_url || "",
        thumbnail_url: resource.thumbnail_url || "",
        subcategory: resource.subcategory || "",
      });
    } else if (!resource && isOpen) {
      setFormData({
        title: "",
        description: "",
        link_url: "",
        thumbnail_url: "",
        subcategory: "",
      });
    }
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryColor("blue");
  }, [resource, isOpen]);

  function handleClose() {
    setFormData({
      title: "",
      description: "",
      link_url: "",
      thumbnail_url: "",
      subcategory: "",
    });
    setShowNewCategory(false);
    setNewCategoryName("");
    setNewCategoryColor("blue");
    onClose();
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

    // Validate thumbnail URL format if provided
    if (formData.thumbnail_url.trim()) {
      try {
        new URL(formData.thumbnail_url.trim());
      } catch {
        showToast("Please enter a valid thumbnail URL", "error");
        return;
      }
    }

    try {
      setSaving(true);

      const thumbnailSource = formData.thumbnail_url.trim() ? "manual" : "none";

      if (resource) {
        // Update existing resource
        const { error: updateError } = await supabase
          .from("resources")
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            link_url: formData.link_url.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            thumbnail_source: thumbnailSource,
            subcategory: formData.subcategory || null,
            updated_by: session?.employee_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", resource.id);

        if (updateError) throw updateError;
        showToast("Resource updated successfully", "success");
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

        // Create new resource
        const { error: insertError } = await supabase.from("resources").insert({
          store_id: storeId,
          category: category,
          subcategory: formData.subcategory || null,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          link_url: formData.link_url.trim() || null,
          thumbnail_url: formData.thumbnail_url.trim() || null,
          thumbnail_source: thumbnailSource,
          display_order: newDisplayOrder,
          is_active: true,
          created_by: session?.employee_id || null,
        });

        if (insertError) throw insertError;
        showToast("Resource added successfully", "success");
      }

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

  // Get active subcategories sorted by display_order
  const activeSubcategories = subcategories
    .filter((c) => c.is_active)
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        resource
          ? "Edit Resource"
          : `Add ${CATEGORY_LABELS[category] || "Resource"}`
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Brief description of this resource (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
            onChange={(e) =>
              setFormData({ ...formData, thumbnail_url: e.target.value })
            }
            placeholder="https://example.com/image.jpg"
            type="url"
          />
          <p className="text-xs text-gray-500 mt-1">
            Direct link to an image for the card preview (optional)
          </p>
        </div>

        {/* Thumbnail Preview */}
        {formData.thumbnail_url && (
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

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving} className="flex-1">
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
      </form>
    </Modal>
  );
}
