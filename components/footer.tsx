export default function Footer() {
  return (
    <footer className="border-t border-border py-3 md:py-4 px-4 md:px-6 bg-card">
      <div className="text-center text-xs md:text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Agrogreen Warehousing Private Limited. All rights reserved.
      </div>
    </footer>
  );
}