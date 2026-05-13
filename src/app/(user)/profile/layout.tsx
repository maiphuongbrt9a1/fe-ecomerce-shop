import Header from "@/components/header/Navbar";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import ProfileDataProvider from "@/components/profile/ProfileDataProvider";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <ProfileDataProvider>
        <main className="flex flex-col md:flex-row flex-1 gap-2 px-3 sm:px-6 md:px-12 lg:px-20 pt-[calc(var(--header-h)_+_1.5rem)]">
          <ProfileSidebar />
          <div className="flex-1 py-4 md:py-6 min-w-0">{children}</div>
        </main>
      </ProfileDataProvider>
    </div>
  );
}
