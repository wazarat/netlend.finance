"use client";
import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { shortAddress } from "@netlend/sdk";

/** 0x12ab...89cd with a copy button and an optional explorer link. */
export function CopyAddress({ address, href }: { address: string; href?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the full address is still in the title attribute */
    }
  };
  return (
    <span className="inline-flex items-center gap-1 nl-num" title={address}>
      <span>{shortAddress(address)}</span>
      <button type="button" className="nl-iconbtn" style={{ width: 28, height: 28 }} onClick={copy} aria-label={copied ? "Copied" : `Copy address ${address}`}>
        {copied ? <Check aria-hidden="true" strokeWidth={1.5} /> : <Copy aria-hidden="true" strokeWidth={1.5} />}
      </button>
      {href && (
        <a className="nl-iconbtn" style={{ width: 28, height: 28 }} href={href} target="_blank" rel="noreferrer" aria-label="Open in block explorer">
          <ExternalLink aria-hidden="true" strokeWidth={1.5} />
        </a>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}
