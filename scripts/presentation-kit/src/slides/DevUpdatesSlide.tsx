import { Slide } from "../components/Slide";
import { SlideContent } from "../components/slideKit";
import type { CornerLabels } from "../types/presentation";

/**
 * Legacy "dev updates" data (two embedded video slots) — orphaned from the
 * default deck. Kept inline so the slide remains a self-contained, optional
 * building block.
 */
export interface DevVideoSlot {
  presenter?: string;
  videoUrl?: string;
  summary?: string;
}

export interface DevUpdatesData {
  subtitle?: string;
  slots?: DevVideoSlot[];
}

const SLOT_COUNT = 2;

const VIDEO_LABELS = ["Video 1", "Video 2"] as const;

const DEFAULT_SUBTITLE =
  "Two short update videos — paste Loom or YouTube links into video 1 and video 2 in the deck data.";

/** Returns iframe src, native video src, or null (placeholder / external link fallback). */
function mediaEmbed(url: string): { kind: "iframe"; src: string } | { kind: "video"; src: string } | null {
  const u = url.trim();
  if (!u) {
    return null;
  }

  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) {
    return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  }

  const loom = u.match(/loom\.com\/share\/([\w-]+)/);
  if (loom) {
    return { kind: "iframe", src: `https://www.loom.com/embed/${loom[1]}` };
  }

  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  }

  if (u.includes("youtube.com/embed") || u.includes("loom.com/embed") || u.includes("player.vimeo.com")) {
    return { kind: "iframe", src: u };
  }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) {
    return { kind: "video", src: u };
  }

  return null;
}

function paddedSlots(slots: DevVideoSlot[] | undefined): DevVideoSlot[] {
  const s = Array.isArray(slots) ? [...slots] : [];
  while (s.length < SLOT_COUNT) {
    s.push({});
  }
  return s.slice(0, SLOT_COUNT);
}

export interface DevUpdatesSlideProps {
  data?: DevUpdatesData;
  corners?: CornerLabels;
}

export function DevUpdatesSlide({ data, corners }: DevUpdatesSlideProps) {
  const slots = paddedSlots(data?.slots);
  const rawSub = data?.subtitle?.trim();
  const subtitle =
    rawSub && !/^team\s*updates$/i.test(rawSub) ? rawSub : DEFAULT_SUBTITLE;

  return (
    <Slide index={3} variant="cream" dataBg="slide-3.jpg" corners={corners}>
      <SlideContent
        title="Team updates"
        subtitle={subtitle}
        contentClassName="slide-content--from-top"
      >
        <div className="dev-updates-grid">
          {slots.map((slot, i) => {
            const label = VIDEO_LABELS[i] ?? `Video ${i + 1}`;
            return (
              <div key={i} className="dev-updates-slot">
                <div className="dev-updates-slot-header">{label}</div>
                <div className="dev-updates-slot-media">
                  {(() => {
                    const url = slot.videoUrl?.trim();
                    if (!url) {
                      return (
                        <div className="dev-updates-slot-placeholder">
                          <span className="dev-updates-slot-hint">
                            Add a Loom or YouTube URL for {label.toLowerCase()} in deck data
                          </span>
                        </div>
                      );
                    }
                    const embed = mediaEmbed(url);
                    if (embed?.kind === "iframe") {
                      return (
                        <iframe
                          title={label}
                          src={embed.src}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                    }
                    if (embed?.kind === "video") {
                      return <video controls playsInline src={embed.src} preload="metadata" />;
                    }
                    return (
                      <div className="dev-updates-slot-placeholder">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="dev-updates-slot-link">
                          Open video link
                        </a>
                      </div>
                    );
                  })()}
                </div>
                {slot.summary?.trim() ? (
                  <div className="dev-updates-slot-summary">{slot.summary.trim()}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </SlideContent>
    </Slide>
  );
}
