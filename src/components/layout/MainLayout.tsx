// src/components/layout/MainLayout.tsx
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
        <div className=" flex flex-1 flex-col p-4 gap-4 pl-22 ">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
