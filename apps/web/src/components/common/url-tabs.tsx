"use client";

import { parseAsString, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@koryo/ui/components/ui/tabs";

export interface UrlTab {
  value: string;
  label: string;
  content: ReactNode;
}

/** Tabs whose selection lives in ?tab= (deep-linkable, survives refresh). Content is server-rendered. */
export function UrlTabs({ tabs, defaultValue }: { tabs: UrlTab[]; defaultValue: string }) {
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault(defaultValue).withOptions({ history: "replace" }));
  return (
    <Tabs value={tab} onValueChange={(v) => void setTab(v === defaultValue ? null : v)}>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="pt-4">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
