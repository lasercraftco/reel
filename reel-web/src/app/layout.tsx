import type { Metadata } from "next";
import { Toaster } from "sonner";

import { BRAND } from "@/lib/brand";
import { ReactQueryProvider } from "@/components/providers/react-query";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  themeColor: "#06080d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ReactQueryProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--brand-surface)",
                color: "var(--brand-text)",
                border: "1px solid var(--brand-surface-2)",
              },
            }}
          />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
