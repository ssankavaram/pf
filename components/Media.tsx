import { asset, isVideo } from "@/lib/content";

export default function Media({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  const url = asset(src);
  return (
    <div className={`media ${className}`}>
      {isVideo(url) ? (
        <video src={`${url}#t=0.001`} autoPlay muted loop playsInline preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} loading="lazy" />
      )}
    </div>
  );
}
