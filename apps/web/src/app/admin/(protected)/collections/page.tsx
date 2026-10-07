import { redirect } from "next/navigation";
import {
  listAdminCollections,
  setCollectionPublished,
  upsertCollectionTranslation,
} from "@movieholix/api/admin";
import { createAdminServerClient } from "@/lib/supabase-server";

export default async function AdminCollectionsPage() {
  const supabase = await createAdminServerClient();
  const collections = await listAdminCollections(supabase);

  async function handleTogglePublish(formData: FormData) {
    "use server";
    const supabase = await createAdminServerClient();
    const id = String(formData.get("id"));
    const isPublished = formData.get("isPublished") === "true";
    await setCollectionPublished(supabase, id, !isPublished);
    redirect("/admin/collections");
  }

  async function handleEditTitle(formData: FormData) {
    "use server";
    const supabase = await createAdminServerClient();
    const id = String(formData.get("id"));
    const title = String(formData.get("title"));
    const intro = String(formData.get("intro") ?? "");
    await upsertCollectionTranslation(
      supabase,
      id,
      "tr",
      title,
      intro || undefined,
    );
    redirect("/admin/collections");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-bold">Koleksiyonlar</h1>
      <ul className="flex flex-col gap-4">
        {collections.map((collection) => (
          <li
            key={collection.id}
            className="rounded-md border border-ink/10 p-3 text-sm"
          >
            <p className="mb-2 font-semibold">
              {collection.title ?? collection.slug} ({collection.kind})
            </p>
            <form action={handleEditTitle} className="mb-2 flex flex-col gap-2">
              <input type="hidden" name="id" value={collection.id} />
              <input
                name="title"
                defaultValue={collection.title ?? ""}
                placeholder="Başlık (tr)"
                className="rounded-md border border-ink/20 px-2 py-1 text-xs"
              />
              <input
                name="intro"
                defaultValue={collection.intro ?? ""}
                placeholder="Giriş metni (tr)"
                className="rounded-md border border-ink/20 px-2 py-1 text-xs"
              />
              <button
                type="submit"
                className="self-start text-xs font-semibold text-reel"
              >
                Kaydet
              </button>
            </form>
            <form action={handleTogglePublish}>
              <input type="hidden" name="id" value={collection.id} />
              <input
                type="hidden"
                name="isPublished"
                value={String(collection.isPublished)}
              />
              <button type="submit" className="text-xs font-semibold text-reel">
                {collection.isPublished ? "Yayından kaldır" : "Yayınla"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
