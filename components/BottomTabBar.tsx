export default function BottomTabBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-14 backdrop-blur"
      style={{
        borderTop: '1px solid var(--color-neutral-800)',
        backgroundColor: 'rgba(10, 10, 10, 0.85)',
        zIndex: 'var(--z-fixed)',
      }}
    >
      <ul className="grid grid-cols-6 h-full text-sm">
        {["Trips", "Spend", "Assign", "Checklists", "Settle", "Me"].map((t) => (
          <li
            key={t}
            className="flex items-center justify-center"
            style={{ color: 'var(--color-neutral-400)' }}
          >
            {t}
          </li>
        ))}
      </ul>
    </nav>
  );
}
