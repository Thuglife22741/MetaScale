import Link from 'next/link';
import { LayoutDashboard, Megaphone, Calculator, Settings, HelpCircle } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[180px] bg-[#0F0F13] border-r border-[#2A2A38] p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-[#F1F1F3] font-bold text-lg tracking-tight">MetaScale</h1>
        <p className="text-[#8B8BA0] text-[10px] uppercase tracking-wider mt-1">ADS Cockpit v1.0</p>
      </div>

      <nav className="flex-1 space-y-2">
        <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm text-[#8B8BA0] hover:text-[#F1F1F3] hover:bg-[#1A1A24] rounded-lg transition-colors">
          <LayoutDashboard size={18} />
          Dashboard
        </Link>
        <Link href="/campanhas" className="flex items-center gap-3 px-3 py-2 text-sm text-[#8B8BA0] hover:text-[#F1F1F3] hover:bg-[#1A1A24] rounded-lg transition-colors">
          <Megaphone size={18} />
          Campaigns
        </Link>
        <Link href="/simulador" className="flex items-center gap-3 px-3 py-2 text-sm text-[#8B8BA0] hover:text-[#F1F1F3] hover:bg-[#1A1A24] rounded-lg transition-colors">
          <Calculator size={18} />
          Simulator
        </Link>
      </nav>

      <div className="mt-auto space-y-2">
        <Link href="/como-funciona" className="flex items-center gap-3 px-3 py-2 text-sm text-[#8B8BA0] hover:text-[#F1F1F3] hover:bg-[#1A1A24] rounded-lg transition-colors">
          <HelpCircle size={18} />
          Como Funciona
        </Link>
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm text-[#8B8BA0] hover:text-[#F1F1F3] hover:bg-[#1A1A24] rounded-lg transition-colors">
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
