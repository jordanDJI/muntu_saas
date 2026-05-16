import MarketingNav from "../../components/MarketingNav";
import MarketingFooter from "../../components/MarketingFooter";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--l-bg)", color: "var(--l-text)", minHeight: "100vh" }}>
      <MarketingNav />
      <div style={{ paddingTop: "68px" }}>
        {children}
      </div>
      <MarketingFooter />
    </div>
  );
}