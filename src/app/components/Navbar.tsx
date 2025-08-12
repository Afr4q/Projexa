"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./Navbar.module.css";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/admin/login", label: "Admin" },
  { href: "/student/login", label: "Student" },
  { href: "/guide/login", label: "Guide" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    // Check if user is logged in by checking localStorage
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setIsLoggedIn(true);
      setUserRole(userData.role);
    } else {
      setIsLoggedIn(false);
      setUserRole("");
    }
  }, [pathname]);

  const getNavLinks = () => {
    if (!isLoggedIn) {
      return navLinks;
    }

    // If logged in, show dashboard links instead of login links
    return [
      { href: "/", label: "Home" },
      ...(userRole === "admin" ? [{ href: "/admin/dashboard", label: "Admin Dashboard" }] : []),
      ...(userRole === "student" ? [{ href: "/student/welcome", label: "Student Dashboard" }] : []),
      ...(userRole === "guide" ? [{ href: "/guide/dashboard", label: "Guide Dashboard" }] : []),
    ];
  };

  const currentLinks = getNavLinks();

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLinks}>
        {currentLinks.map(link => (
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
        {isLoggedIn && (
          <button
            onClick={() => {
              localStorage.removeItem('user');
              setIsLoggedIn(false);
              setUserRole("");
              window.location.href = "/";
            }}
            className={styles.navLink}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
} 