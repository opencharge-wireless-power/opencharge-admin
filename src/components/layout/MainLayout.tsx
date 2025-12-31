import type { ReactNode } from "react";
import { SidebarProvider, SidebarInset} from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSideBar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
     <SidebarInset>
        {/* Page content */}
        <main className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}