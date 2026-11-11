import { Link } from "@tanstack/react-router";
import { type CatalogLinkKey, catalogLinks } from "#src/shell/navigation.js";
import styles from "#src/styles/top-bar.module.scss";

interface VenueOption {
  value: string;
  label: string;
}

interface TopBarProps {
  current: CatalogLinkKey;
  venue: {
    value: string;
    options: VenueOption[];
    onChange: (value: string) => void;
  };
}

export function TopBar({ current, venue }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <ol className={styles.trail}>
        <li className={styles.trailItem}>Catálogo</li>
        {catalogLinks.map((link) => (
          <li key={link.key} className={styles.trailItem}>
            <span aria-hidden="true">·</span>
            <Link
              to={link.to}
              className={link.key === current ? styles.current : styles.link}
              aria-current={link.key === current ? "page" : undefined}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ol>
      <label>
        <span className="srOnly">Sede</span>
        <select
          className={styles.venue}
          value={venue.value}
          onChange={(event) => venue.onChange(event.target.value)}
        >
          {venue.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}
