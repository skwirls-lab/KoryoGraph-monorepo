"use client";

import { Search } from "lucide-react";
import { toast } from "sonner";
import { DateText } from "@koryo/ui/components/app/date-text";
import { EmptyState } from "@koryo/ui/components/app/empty-state";
import { MoneyText } from "@koryo/ui/components/app/money-text";
import { PageHeader } from "@koryo/ui/components/app/page-header";
import { PersonChip } from "@koryo/ui/components/app/person-chip";
import { RankBadge } from "@koryo/ui/components/app/rank-badge";
import { StatCard } from "@koryo/ui/components/app/stat-card";
import { ThemeToggle } from "@koryo/ui/components/app/theme-toggle";
import { THEMES } from "@koryo/ui/components/theme/theme";
import { Avatar, AvatarFallback } from "@koryo/ui/components/ui/avatar";
import { Badge } from "@koryo/ui/components/ui/badge";
import { Button } from "@koryo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@koryo/ui/components/ui/card";
import { Checkbox } from "@koryo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@koryo/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@koryo/ui/components/ui/dropdown-menu";
import { Input } from "@koryo/ui/components/ui/input";
import { Label } from "@koryo/ui/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@koryo/ui/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@koryo/ui/components/ui/radio-group";
import { ScrollArea } from "@koryo/ui/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@koryo/ui/components/ui/select";
import { Separator } from "@koryo/ui/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@koryo/ui/components/ui/sheet";
import { Skeleton } from "@koryo/ui/components/ui/skeleton";
import { Switch } from "@koryo/ui/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@koryo/ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@koryo/ui/components/ui/tabs";
import { Textarea } from "@koryo/ui/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@koryo/ui/components/ui/tooltip";

// The values below are component specimens for a design-system check page, not product data.
const SPECIMEN_DATE = "2026-09-22T21:30:00Z";

function Specimens({ theme }: { theme: string }) {
  return (
    <section data-theme={theme} className="space-y-6 rounded-2xl border border-default bg-background p-6 text-foreground" aria-label={`Theme ${theme}`}>
      <PageHeader eyebrow={`Theme · ${theme}`} title="Component specimens" description="Every kit component rendered in this theme." actions={<Button>Primary action</Button>} />
      <div className="flex flex-wrap gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button size="icon" aria-label="Search"><Search /></Button>
        <Button onClick={() => toast.success(`Toast from ${theme}`)}>Toast</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Stat card" value="128" delta="+4 vs last week" tone="positive" />
        <StatCard label="Money" value={<MoneyText cents={1234567} />} hint="MoneyText" />
        <StatCard label="Date" value={<DateText value={SPECIMEN_DATE} timeZone="America/New_York" style="short" />} hint="DateText (tenant tz)" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RankBadge name="Yellow belt" beltColor="#facc15" stripes={2} stripesMax={4} />
        <RankBadge name="Black belt" beltColor="#111111" />
        <PersonChip name="Specimen Person" meta="Person chip" />
        <Badge>Badge</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Avatar><AvatarFallback>KG</AvatarFallback></Avatar>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`in-${theme}`}>Input</Label>
          <Input id={`in-${theme}`} placeholder="Type here" />
          <Label htmlFor={`ta-${theme}`}>Textarea</Label>
          <Textarea id={`ta-${theme}`} placeholder="Notes" />
          <Label htmlFor={`sel-${theme}`}>Select</Label>
          <Select>
            <SelectTrigger id={`sel-${theme}`} className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a">Option A</SelectItem>
              <SelectItem value="b">Option B</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Checkbox id={`cb-${theme}`} /><Label htmlFor={`cb-${theme}`}>Checkbox</Label></div>
          <div className="flex items-center gap-2"><Switch id={`sw-${theme}`} /><Label htmlFor={`sw-${theme}`}>Switch</Label></div>
          <RadioGroup defaultValue="one" aria-label="Radio group">
            <div className="flex items-center gap-2"><RadioGroupItem value="one" id={`r1-${theme}`} /><Label htmlFor={`r1-${theme}`}>One</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="two" id={`r2-${theme}`} /><Label htmlFor={`r2-${theme}`}>Two</Label></div>
          </RadioGroup>
          <Skeleton className="h-6 w-40" />
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Dialog</DialogTitle><DialogDescription>Keyboard-operable dialog.</DialogDescription></DialogHeader>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">Sheet</Button></SheetTrigger>
              <SheetContent><SheetHeader><SheetTitle>Sheet</SheetTitle></SheetHeader></SheetContent>
            </Sheet>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger>
              <PopoverContent>Popover content</PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline">Menu</Button></DropdownMenuTrigger>
              <DropdownMenuContent><DropdownMenuItem>Item one</DropdownMenuItem><DropdownMenuItem>Item two</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline">Tooltip</Button></TooltipTrigger>
              <TooltipContent>Tooltip text</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <Tabs defaultValue="table">
        <TabsList><TabsTrigger value="table">Table</TabsTrigger><TabsTrigger value="card">Card</TabsTrigger><TabsTrigger value="empty">Empty</TabsTrigger></TabsList>
        <TabsContent value="table">
          <ScrollArea className="h-40 rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Column</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TableRow key={n}><TableCell>Row {n}</TableCell><TableCell className="text-right"><MoneyText cents={n * 1000} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="card">
          <Card><CardHeader><CardTitle>Card</CardTitle><CardDescription>Card description</CardDescription></CardHeader><CardContent>Card content</CardContent></Card>
        </TabsContent>
        <TabsContent value="empty">
          <EmptyState title="Nothing here yet" description="Honest empty state copy." />
        </TabsContent>
      </Tabs>
    </section>
  );
}

export function UiShowcase() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <PageHeader title="KoryoGraph UI kit" description="Dev-only design-system check (M0.05)." actions={<ThemeToggle />} />
      {THEMES.map((t) => (
        <Specimens key={t} theme={t} />
      ))}
    </main>
  );
}
