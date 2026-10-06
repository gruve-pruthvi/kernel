import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";

export default function GuiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {children}
      </main>
      <Footer />
    </>
  );
}
