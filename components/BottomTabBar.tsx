export default function BottomTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 border-t border-zinc-800 bg-black/85 backdrop-blur">
      <ul className="grid grid-cols-6 h-full text-sm">
        {["Trips","Spend","Assign","Checklists","Settle","Me"].map((t) => (
          <li key={t} className="flex items-center justify-center">{t}</li>
        ))}
      </ul>
    </nav>
  );
}
