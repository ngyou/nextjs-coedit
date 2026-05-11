"use client";

import { useEffect, useRef } from "react";
import { defaultKeymap } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";

import { CHAR_HARD_LIMIT, CHAR_SOFT_LIMIT } from "@/lib/constants";
import type { CollabRuntime } from "@/lib/types";

type Props = {
  runtime: CollabRuntime;
  onCharCount: (count: number) => void;
  onHardLimit: () => void;
  onSoftLimit: () => void;
  onDocChanged: (count: number) => void;
};

export function CollabEditor({ runtime, onCharCount, onHardLimit, onSoftLimit, onDocChanged }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const softWarnedRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current) return;

    const yUndoManager = new Y.UndoManager(runtime.ytext);
    const charLimit = EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged) return tr;
      const nextLength = tr.newDoc.length;
      if (nextLength > CHAR_HARD_LIMIT) {
        onHardLimit();
        return [];
      }
      if (nextLength > CHAR_SOFT_LIMIT && !softWarnedRef.current) {
        softWarnedRef.current = true;
        onSoftLimit();
      }
      return tr;
    });

    const state = EditorState.create({
      doc: runtime.ytext.toString(),
      extensions: [
        lineNumbers(),
        keymap.of([...defaultKeymap, ...yUndoManagerKeymap]),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            height: "100%",
            width: "100%",
          },
          ".cm-scroller": {
            minHeight: "100%",
            overflow: "auto",
          },
          ".cm-content, .cm-gutter": {
            minHeight: "100%",
          },
          ".cm-content": {
            paddingBottom: "1.5rem",
          },
        }),
        charLimit,
        yCollab(runtime.ytext, runtime.awareness, { undoManager: yUndoManager }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onCharCount(update.state.doc.length);
            onDocChanged(update.state.doc.length);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onCharCount(view.state.doc.length);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [onCharCount, onDocChanged, onHardLimit, onSoftLimit, runtime]);

  return (
    <div
      ref={hostRef}
      onMouseDown={() => viewRef.current?.focus()}
      className="h-[clamp(20rem,65vh,52rem)] w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
    />
  );
}
