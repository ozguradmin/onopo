import { HeroSection } from "@/components/home/HeroSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import ProductShowcase from "@/components/home/ProductShowcase";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <HeroSection />
      <ProductShowcase />
      <FeaturesSection />
    </div>
  );
}
