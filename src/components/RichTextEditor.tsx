import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ImagePlus,
} from "lucide-react";
import { useRef } from "react";
import { useToast } from "./ui/Toast";
import { useSettings } from "../contexts/SettingsContext";
import { compressImage } from "../lib/image-utils";
import { getStorageService } from "../lib/storage";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string, text: string) => void;
  storeId: string;
  placeholder?: string;
}

export function RichTextEditor({
  content,
  onChange,
  storeId,
  placeholder = "Write description...",
}: RichTextEditorProps) {
  const { showToast } = useToast();
  const { getStorageConfig } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "rich-text-image",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: "ProseMirror",
      },
    },
  });

  if (!editor) return null;

  async function handleImageUpload(file: File) {
    if (!editor) return;
    if (uploadingRef.current) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showToast("Please select a JPEG, PNG, or WebP image", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be under 5MB", "error");
      return;
    }

    const storageConfig = getStorageConfig();
    if (!storageConfig?.r2Config?.publicUrl) {
      showToast("Photo storage is not configured", "error");
      return;
    }

    try {
      uploadingRef.current = true;
      const compressed = await compressImage(file);
      const storage = getStorageService(storageConfig);

      const timestamp = Date.now();
      const uuid = crypto.randomUUID();
      const path = `resources/${storeId}/inline/${timestamp}_${uuid}.jpg`;

      const result = await storage.upload(path, compressed, {
        contentType: "image/jpeg",
      });

      if (!result.success) {
        showToast("Failed to upload image", "error");
        return;
      }

      const publicUrl = storageConfig.r2Config.publicUrl.replace(/\/$/, "");
      editor
        .chain()
        .focus()
        .setImage({ src: `${publicUrl}/${path}` })
        .run();
    } catch {
      showToast("Failed to upload image", "error");
    } finally {
      uploadingRef.current = false;
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  const ToolbarButton = ({
    onClick,
    isActive = false,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-700"
          : "bg-gray-50 hover:bg-gray-100 text-gray-600"
      }`}
    >
      {children}
    </button>
  );

  const iconSize = "w-4 h-4";

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          title="Insert Image"
        >
          <ImagePlus className={iconSize} />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
}
