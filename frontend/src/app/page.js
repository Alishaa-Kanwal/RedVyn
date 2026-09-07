import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { ForHospitals } from "@/components/sections/for-hospitals";
import { About } from "@/components/sections/about";
import { Impact } from "@/components/sections/impact";
import { FAQ } from "@/components/sections/faq";
import { Contact } from "@/components/sections/contact";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <ForHospitals />
        <About />
        <Impact />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}