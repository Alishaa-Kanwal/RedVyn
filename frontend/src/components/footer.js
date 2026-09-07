import Link from "next/link";
import { FiFacebook, FiInstagram, FiYoutube } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { Logo } from "@/components/logo";

const COLUMNS = [
  {
    title: "Quick Links",
    links: [
      { label: "Home", href: "#home" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "For Hospitals", href: "#for-hospitals" },
      { label: "About Us", href: "#about" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "For Donors",
    links: [
      { label: "Become a Donor", href: "/auth/signup?role=donor" },
      { label: "Donation Process", href: "#how-it-works" },
      { label: "FAQs", href: "#faq" },
    ],
  },
  {
    title: "For Patients",
    links: [
      { label: "Patient Registration", href: "/auth/signup?role=guardian" },
      { label: "Find Donors", href: "#how-it-works" },
      { label: "FAQs", href: "#faq" },
    ],
  },
  {
    title: "For Hospitals",
    links: [
      { label: "Hospital Partner", href: "/auth/signup?role=hospital" },
      { label: "Emergency Support", href: "#contact" },
      { label: "Dashboard Login", href: "/auth/signin" },
    ],
  },
];

const SOCIALS = [
  { icon: FiFacebook, label: "Facebook" },
  { icon: FiInstagram, label: "Instagram" },
  { icon: FaWhatsapp, label: "WhatsApp" },
  { icon: FiYoutube, label: "YouTube" },
];

function FooterLink({ href, children }) {
  const isExternal = href.startsWith("http");
  const isAnchor = href.startsWith("#");
  const className = "text-sm transition-colors hover:text-primary";

  if (isAnchor || isExternal) {
    return (
      <a href={href} className={className} {...(isExternal && { target: "_blank", rel: "noreferrer" })}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#0d0d0f] text-white/70">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Logo dark />
            <p className="mt-4 max-w-[22ch] text-sm">
              Right Donor. Right Time. Real Lives.
            </p>
            <div className="mt-5 flex gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-primary"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-white">{column.title}</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/50 sm:text-left">
          © {new Date().getFullYear()} RedVyn. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
