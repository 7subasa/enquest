"use client";

import { QrCode, Grid3X3, User, Bot } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const tabs = [
  { id: "qr", label: "マイQR", icon: QrCode, path: "/" },
  { id: "bingo", label: "ビンゴ", icon: Grid3X3, path: "/bingo" },
  { id: "profile", label: "プロフィール", icon: User, path: "/profile" },
  { id: "chat", label: "AIアシスタント", icon: Bot, path: "/chat" },
];

export default function TabNavigation() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.path;
          
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex-1 flex flex-col items-center py-2 px-1 ${
                isActive 
                  ? "text-blue-600" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}