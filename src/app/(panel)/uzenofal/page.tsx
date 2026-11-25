import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesSquare, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ConfirmButton } from "@/components/confirm-button";
import { PageTitle } from "@/components/page-title";
import { PostForm } from "@/components/text-forms";
import { Empty, Panel, Pill, Skeleton } from "@/components/ui";
import { deletePost, togglePin } from "@/lib/actions";
import { formatAgo, formatStamp } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { listPosts, nameMap } from "@/lib/workspace";

export const metadata: Metadata = { title: "Üzenőfal" };

export default function WallPage() {
  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Üzenőfal" title="Ami mindenkire" accent="tartozik.">
        Döntések, hírek, egyeztetések. A fontos üzeneteket bárki kitűzheti – ezek az Áttekintésen is megjelennek.
      </PageTitle>
      <Panel title="Új üzenet" icon={Send}>
        <PostForm />
      </Panel>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Wall />
      </Suspense>
    </div>
  );
}

async function Wall() {
  const user = await requireUser();
  const [posts, names] = await Promise.all([listPosts(200), nameMap()]);
  const now = new Date();
  if (posts.length === 0) return <Empty icon={MessagesSquare} title="Még üres az üzenőfal" text="Írd meg az első üzenetet a csapatnak." />;

  return (
    <ul className="space-y-4">
      {posts.map((post) => {
        const author = names.get(String(post.authorId)) ?? "?";
        return (
          <li key={String(post._id)} className={`pg-panel rounded-3xl p-5 ${post.pinned ? "ring-1 ring-gold/35" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={author} size={34} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{author}</p>
                <p className="text-xs text-white/45" title={formatStamp(post.createdAt)}>
                  {formatAgo(post.createdAt, now)}
                </p>
              </div>
              {post.pinned && (
                <Pill tone="warning" icon={Pin}>
                  Kitűzve
                </Pill>
              )}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-white/85 [overflow-wrap:anywhere]">{post.body}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/6 pt-3">
              <form action={togglePin}>
                <input type="hidden" name="id" value={String(post._id)} />
                <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-white/60 transition hover:bg-white/6 hover:text-white">
                  {post.pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />}
                  {post.pinned ? "Kitűzés levétele" : "Kitűzés"}
                </button>
              </form>
              {post.authorId.equals(user.oid) && (
                <form action={deletePost}>
                  <input type="hidden" name="id" value={String(post._id)} />
                  <ConfirmButton size="sm" message="Biztosan törlöd az üzenetet? A törlés a naplóban megmarad.">
                    <Trash2 size={15} aria-hidden /> Törlés
                  </ConfirmButton>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
