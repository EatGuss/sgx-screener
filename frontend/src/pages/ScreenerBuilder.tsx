import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { StockRow } from "screener-contract";
import { ActiveFilterChips } from "@/components/filters/ActiveFilterChips";
import { FilterPillBar } from "@/components/filters/FilterPillBar";
import { MobileFilterSheet } from "@/components/filters/MobileFilterSheet";
import { DataFreshness } from "@/components/results/DataFreshness";
import { ColumnPicker } from "@/components/results/ColumnPicker";
import { ResultsPagination } from "@/components/results/ResultsPagination";
import { ResultsTable } from "@/components/results/ResultsTable";
import { StockDetailDrawer } from "@/components/results/StockDetailDrawer";
import { ChartErrorBoundary } from "@/components/results/ChartErrorBoundary";
import { LiveCountBadge } from "@/components/screener/LiveCountBadge";
import { ScreenNameMenu } from "@/components/screener/ScreenNameMenu";
import { ScreenerAppShell } from "@/components/ScreenerAppShell";
import { InlineError } from "@/components/screener/InlineError";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedScreenCount } from "@/hooks/useDebouncedScreenCount";
import { useDebouncedScreenResults } from "@/hooks/useDebouncedScreenResults";
import { useApplyScreenerDefaults } from "@/hooks/useApplyScreenerDefaults";
import { EnumFacetsProvider } from "@/hooks/useEnumFacets";
import { useScreenerSettings } from "@/hooks/useScreenerSettings";
import { useScreenSpec } from "@/hooks/useScreenSpec";
import { useScreenUrlSync } from "@/hooks/useScreenUrlSync";
import {
  COLUMN_PRESETS,
  resolveColumnFields,
  type ColumnPresetId,
  type ColumnTabId,
} from "@/lib/screener/column-presets";
import { cn } from "@/lib/utils";

function ScreenerBuilderContent() {
  useScreenUrlSync();
  useApplyScreenerDefaults();
  const isMobile = useIsMobile();
  const { settings } = useScreenerSettings();
  const {
    spec,
    excludeTicker,
    customColumns,
    screenId,
    source,
    setSort,
    setPage,
    setPageSize,
    clearConditions,
    toggleCustomColumn,
    removeCustomColumn,
    moveCustomColumn,
  } = useScreenSpec();

  // Live-apply rows-per-page when the preference changes.
  useEffect(() => {
    setPageSize(settings.pageSize);
  }, [settings.pageSize, setPageSize]);
  const {
    data,
    loading: resultsLoading,
    error: resultsError,
    retry: retryResults,
  } = useDebouncedScreenResults(spec);
  const {
    count,
    loading: countLoading,
    error: countError,
    retry: retryCount,
  } = useDebouncedScreenCount(spec);
  const [columnTab, setColumnTab] = useState<ColumnTabId>(
    () => settings.defaultColumnTab,
  );
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<StockRow | null>(null);

  // Keep the default tab in sync when preferences change and we're not on Custom.
  useEffect(() => {
    if (customColumns.length > 0) return;
    setColumnTab(settings.defaultColumnTab);
  }, [settings.defaultColumnTab, customColumns.length]);

  // Land on Custom when opening a screen that carries a column set.
  useEffect(() => {
    if (customColumns.length > 0) {
      setColumnTab("custom");
    }
  }, [screenId, source, customColumns.length]);

  const isCustomTab = columnTab === "custom";
  const activePreset = isCustomTab
    ? null
    : (COLUMN_PRESETS.find((p) => p.id === columnTab) ?? COLUMN_PRESETS[0]!);

  const displayColumns = isCustomTab
    ? customColumns
    : resolveColumnFields(
        columnTab as ColumnPresetId,
        activePreset!.fields,
        isMobile,
      );

  const displayRows =
    excludeTicker && data
      ? data.rows.filter((r) => r.ticker !== excludeTicker)
      : (data?.rows ?? []);

  const displayTotal =
    data && excludeTicker ? Math.max(0, data.total - 1) : (data?.total ?? 0);

  const requestError = resultsError ?? countError;
  const firstLoadFailed = Boolean(requestError && !data);

  function handleRetry() {
    retryResults();
    retryCount();
  }

  function handleRowClick(row: StockRow) {
    setSelectedTicker(row.ticker);
    setSelectedRow(row);
  }

  const staleBannerMessage =
    "Couldn't reach the server — showing last known results";
  const firstLoadMessage = "Couldn't reach the server";

  const showCustomEmpty =
    isCustomTab && customColumns.length === 0 && !resultsLoading && !firstLoadFailed;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1 shrink-0" />
            <ScreenNameMenu rows={displayRows} columns={displayColumns} />
          </div>
          <DataFreshness asOf={data?.asOf} className="shrink-0 text-right" />
        </div>
      </header>

      <div className="flex flex-1 flex-col min-h-0">
        <div className="space-y-3 border-b px-4 py-3">
          {isMobile ? (
            <MobileFilterSheet
              count={count}
              countLoading={countLoading}
              countError={countError}
            />
          ) : (
            <FilterPillBar />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
              <Tabs
                value={columnTab}
                onValueChange={(v) => setColumnTab(v as ColumnTabId)}
                className="min-w-0 max-w-full"
              >
                <TabsList
                  variant="line"
                  className={cn(
                    "h-auto max-w-full flex-nowrap justify-start pb-1",
                    "overflow-x-auto overflow-y-hidden overscroll-x-contain",
                    "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  )}
                >
                  {COLUMN_PRESETS.map((preset) => (
                    <TabsTrigger
                      key={preset.id}
                      value={preset.id}
                      className="flex-none"
                    >
                      {preset.label}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="custom" className="flex-none">
                    Custom
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {isCustomTab ? (
                <Popover open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 px-3 text-xs"
                    >
                      <Plus className="size-3.5" />
                      {customColumns.length === 0 ? "Add columns" : "Edit columns"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-80 overflow-hidden p-0"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <ColumnPicker
                      selected={customColumns}
                      onToggle={toggleCustomColumn}
                      onClose={() => setColumnPickerOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
            {!isMobile && (
              <LiveCountBadge
                count={count}
                loading={countLoading}
                error={countError}
              />
            )}
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4">
          {isMobile && (
            <ActiveFilterChips
              scrollable
              hideEmptyHint
              className="mb-3"
            />
          )}

          {firstLoadFailed ? (
            <InlineError
              variant="panel"
              message={firstLoadMessage}
              onRetry={handleRetry}
            />
          ) : showCustomEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Choose columns for your custom view
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setColumnPickerOpen(true)}
              >
                <Plus className="size-3.5" />
                Add columns
              </Button>
            </div>
          ) : (
            <>
              {requestError && (
                <div className="mb-4">
                  <InlineError
                    variant="banner"
                    message={staleBannerMessage}
                    onRetry={handleRetry}
                  />
                </div>
              )}
              <ResultsTable
                rows={displayRows}
                loading={resultsLoading}
                hasError={Boolean(requestError)}
                sort={spec.sort}
                onSort={setSort}
                columns={displayColumns}
                onRowClick={handleRowClick}
                onClearFilters={clearConditions}
                compact={isMobile || settings.rowDensity === "compact"}
                hideSparkline={isMobile && columnTab === "overview"}
                customColumnActions={
                  isCustomTab
                    ? {
                        onRemove: removeCustomColumn,
                        onMove: moveCustomColumn,
                      }
                    : undefined
                }
              />
              {data && displayColumns.length > 0 && (
                <ResultsPagination
                  page={data.page}
                  pageSize={spec.pageSize ?? 50}
                  total={displayTotal}
                  onPageChange={setPage}
                  disabled={resultsLoading}
                />
              )}
            </>
          )}
        </main>
      </div>

      <ChartErrorBoundary
        fallbackLabel="Couldn't load stock detail"
        resetKey={selectedTicker}
      >
        <StockDetailDrawer
          ticker={selectedTicker}
          row={selectedRow}
          open={selectedTicker != null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTicker(null);
              setSelectedRow(null);
            }
          }}
        />
      </ChartErrorBoundary>
    </div>
  );
}

export default function ScreenerBuilder() {
  return (
    <ScreenerAppShell>
      <EnumFacetsProvider>
        <ScreenerBuilderContent />
      </EnumFacetsProvider>
    </ScreenerAppShell>
  );
}
