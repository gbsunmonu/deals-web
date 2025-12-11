'use client';

export default function DeleteDealButton({ id }: { id: string }) {
  return (
    <form
      action={`/api/deals/${id}/delete`}
      method="POST"
      onSubmit={(e) => {
        if (!confirm('Are you sure you want to delete this deal?')) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="inline-flex items-center rounded-lg border border-red-500 text-red-600 px-3 py-2 text-sm font-medium hover:bg-red-50"
      >
        Delete
      </button>
    </form>
  );
}
