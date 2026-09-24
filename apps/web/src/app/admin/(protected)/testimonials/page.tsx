import { redirect } from "next/navigation";
import { listTestimonials, upsertTestimonial } from "@reelmate/api/admin";
import { createAdminServerClient } from "@/lib/supabase-server";

export default async function AdminTestimonialsPage() {
  const supabase = await createAdminServerClient();
  const testimonials = await listTestimonials(supabase);

  async function handleTogglePublish(formData: FormData) {
    "use server";
    const supabase = await createAdminServerClient();
    const id = String(formData.get("id"));
    const locale = String(formData.get("locale")) as "tr" | "en";
    const quote = String(formData.get("quote"));
    const displayName = String(formData.get("displayName"));
    const isPublished = formData.get("isPublished") === "true";
    await upsertTestimonial(supabase, {
      id,
      locale,
      quote,
      displayName,
      isPublished: !isPublished,
    });
    redirect("/admin/testimonials");
  }

  async function handleCreate(formData: FormData) {
    "use server";
    const supabase = await createAdminServerClient();
    await upsertTestimonial(supabase, {
      locale: String(formData.get("locale")) as "tr" | "en",
      quote: String(formData.get("quote")),
      displayName: String(formData.get("displayName")),
      city: String(formData.get("city") ?? "") || undefined,
      isPublished: false,
    });
    redirect("/admin/testimonials");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-bold">Testimoniallar</h1>
      <ul className="mb-8 flex flex-col gap-2">
        {testimonials.map((testimonial) => (
          <li
            key={testimonial.id}
            className="rounded-md border border-ink/10 p-3 text-sm"
          >
            <p className="mb-1">
              &ldquo;{testimonial.quote}&rdquo; — {testimonial.displayName}
            </p>
            <form action={handleTogglePublish}>
              <input type="hidden" name="id" value={testimonial.id} />
              <input type="hidden" name="locale" value={testimonial.locale} />
              <input type="hidden" name="quote" value={testimonial.quote} />
              <input
                type="hidden"
                name="displayName"
                value={testimonial.displayName}
              />
              <input
                type="hidden"
                name="isPublished"
                value={String(testimonial.isPublished)}
              />
              <button type="submit" className="text-xs font-semibold text-reel">
                {testimonial.isPublished ? "Yayından kaldır" : "Yayınla"}
              </button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 font-semibold">Yeni testimonial</h2>
      <form action={handleCreate} className="flex flex-col gap-3">
        <select
          name="locale"
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        >
          <option value="tr">tr</option>
          <option value="en">en</option>
        </select>
        <textarea
          name="quote"
          placeholder="Alıntı"
          required
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <input
          name="displayName"
          placeholder="Ad"
          required
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <input
          name="city"
          placeholder="Şehir (opsiyonel)"
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-reel px-3 py-2 text-sm font-semibold text-white"
        >
          Ekle
        </button>
      </form>
    </div>
  );
}
