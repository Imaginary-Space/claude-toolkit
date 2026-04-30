import { useState, useRef, useEffect, type CSSProperties, type FormEvent } from "react";

/**
 * Pluggable image generator — the host app provides an async function that
 * turns a text prompt into an image URL. Return `null` (or throw) to skip
 * applying the result.
 */
export type ImageLoader = (prompt: string) => Promise<{ url: string } | null>;

export interface GenerativeImageProps {
  defaultSrc: string;
  defaultPrompt: string;
  style?: CSSProperties;
  /** Called once a new image is successfully generated. */
  onGenerated?: (url: string, prompt: string) => void;
  /** When omitted, the prompt input is hidden and the component is read-only. */
  imageLoader?: ImageLoader;
  /** Override the placeholder copy for the input. */
  placeholder?: string;
}

/**
 * Image card with an optional inline prompt bar (revealed on hover) for
 * regenerating the image. When `imageLoader` is omitted the input is hidden,
 * making this a plain image frame.
 *
 * The visual styling lives in `presentations.css` under `.gen-image-*`.
 */
export function GenerativeImage({
  defaultSrc,
  defaultPrompt,
  style,
  onGenerated,
  imageLoader,
  placeholder = "Describe an image…",
}: GenerativeImageProps) {
  const [src, setSrc] = useState(defaultSrc);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setSrc(defaultSrc), [defaultSrc]);
  useEffect(() => setPrompt(defaultPrompt), [defaultPrompt]);

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!prompt.trim() || loading || !imageLoader) {
      return;
    }
    setLoading(true);
    try {
      const result = await imageLoader(prompt);
      if (result?.url) {
        setSrc(result.url);
        onGenerated?.(result.url, prompt);
      }
    } catch (err) {
      console.error("[GenerativeImage] imageLoader failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="gen-image-wrap"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {src ? <img src={src} alt="" crossOrigin="anonymous" /> : null}

      {loading ? (
        <div className="gen-image-loading">
          <span className="gen-image-spinner" />
        </div>
      ) : null}

      {imageLoader ? (
        <form
          className="gen-image-bar"
          data-visible={hovered || loading}
          onSubmit={(e) => {
            void generate(e);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            spellCheck={false}
          />
        </form>
      ) : null}
    </div>
  );
}
