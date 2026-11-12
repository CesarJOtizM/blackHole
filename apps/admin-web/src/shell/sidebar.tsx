import { Link } from "@tanstack/react-router";
import { NavIcon } from "#src/shell/nav-icon.js";
import { navigation } from "#src/shell/navigation.js";
import styles from "#src/styles/shell.module.scss";

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <p className={styles.brandName}>Blackhole</p>
        <p className={styles.company}>La Parrilla SAS</p>
      </div>
      {navigation.map((section) => (
        <nav
          key={section.label}
          className={styles.section}
          aria-label={section.label}
        >
          <p className={styles.sectionLabel}>{section.label}</p>
          {section.items.map((item) => {
            const active = item.match(pathname);
            return (
              <div key={item.to}>
                <Link
                  to={item.to}
                  className={active ? styles.itemActive : styles.item}
                  aria-current={active ? "page" : undefined}
                >
                  {item.icon ? <NavIcon name={item.icon} /> : null}
                  {item.label}
                </Link>
                {item.children?.map((child) => {
                  const childActive = child.match(pathname);
                  return (
                    <Link
                      key={child.to}
                      to={child.to}
                      className={
                        childActive ? styles.subitemActive : styles.subitem
                      }
                      aria-current={childActive ? "page" : undefined}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      ))}
      <div className={styles.spacer} />
      <div className={styles.user}>
        <p className={styles.userName}>Carolina Méndez</p>
        <p className={styles.userRole}>Propietaria</p>
      </div>
    </aside>
  );
}
