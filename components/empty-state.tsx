export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel p-6 text-center">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-ink/70">{text}</p>
    </div>
  );
}
