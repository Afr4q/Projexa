"use client";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/admin/login", label: "Admin" },
  { href: "/student/login", label: "Student" },
  { href: "/guide/login", label: "Guide" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLinks}>
        {navLinks.map(link => (
          <a
            key={link.href}
            href={link.href}
            className={
              pathname === link.href
                ? `${styles.navLink} ${styles.active}`
                : styles.navLink
            }
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
} 