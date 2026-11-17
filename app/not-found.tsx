import Link from "next/link";
export default function NotFound() {
  return (
    <main className="wrap">
      <p className="body">Page not found. <Link className="ulink" href="/">Go home</Link></p>
    </main>
  );
}
