import {
    useCostByModel,
    useCostByDay,
    useCostByProject,
    useTotalCost,
    formatCost,
} from "@core/chorus/api/CostAPI";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { ProviderLogo } from "@ui/components/ui/provider-logo";

function CostBar({ value, max }: { value: number; max: number }) {
    const width = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
                className="h-full bg-primary/60 rounded-full transition-all"
                style={{ width: `${width}%` }}
            />
        </div>
    );
}

export function CostDashboard() {
    const { data: totalCost } = useTotalCost();
    const { data: costByModel = [] } = useCostByModel();
    const { data: costByDay = [] } = useCostByDay();
    const { data: costByProject = [] } = useCostByProject();
    const { data: modelConfigs } = ModelsAPI.useModelConfigs();

    const getDisplayName = (modelId: string): string => {
        const config = modelConfigs?.find((c) => c.modelId === modelId);
        return config?.displayName || modelId;
    };

    const maxModelCost = Math.max(...costByModel.map((m) => m.total_cost), 0);

    const maxDayCost = Math.max(...costByDay.map((d) => d.total_cost), 0);

    const maxProjectCost = Math.max(
        ...costByProject.map((p) => p.total_cost),
        0,
    );

    // Recent period costs
    const last7DaysCost = (() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        return costByDay
            .filter((d) => d.date >= cutoffStr)
            .reduce((sum, d) => sum + d.total_cost, 0);
    })();

    const last30DaysCost = costByDay.reduce(
        (sum, d) => sum + d.total_cost,
        0,
    );

    if (totalCost === undefined) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                Loading cost data...
            </div>
        );
    }

    if (totalCost === 0 && costByModel.length === 0) {
        return (
            <div className="p-4 text-sm text-muted-foreground">
                No usage data yet. Cost tracking starts when you send messages.
            </div>
        );
    }

    return (
        <div className="space-y-6 p-1">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">All time</p>
                    <p className="text-lg font-semibold">
                        {formatCost(totalCost)}
                    </p>
                </div>
                <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                    <p className="text-lg font-semibold">
                        {formatCost(last7DaysCost)}
                    </p>
                </div>
                <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                        Last 30 days
                    </p>
                    <p className="text-lg font-semibold">
                        {formatCost(last30DaysCost)}
                    </p>
                </div>
            </div>

            {/* Cost by model */}
            {costByModel.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium mb-3">Cost by model</h3>
                    <div className="space-y-2">
                        {costByModel.map((item) => (
                            <div key={item.model} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <ProviderLogo
                                            modelId={item.model}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="truncate max-w-[200px]">
                                            {getDisplayName(item.model)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            ({item.message_count} messages)
                                        </span>
                                    </div>
                                    <span className="font-medium">
                                        {formatCost(item.total_cost)}
                                    </span>
                                </div>
                                <CostBar
                                    value={item.total_cost}
                                    max={maxModelCost}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cost by project */}
            {costByProject.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium mb-3">
                        Cost by project
                    </h3>
                    <div className="space-y-2">
                        {costByProject.map((item) => (
                            <div key={item.project_id} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="truncate max-w-[250px]">
                                        {item.project_id === "default"
                                            ? "Default"
                                            : item.project_name}
                                    </span>
                                    <span className="font-medium">
                                        {formatCost(item.total_cost)}
                                    </span>
                                </div>
                                <CostBar
                                    value={item.total_cost}
                                    max={maxProjectCost}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Daily cost (last 30 days) */}
            {costByDay.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium mb-3">
                        Daily cost (last 30 days)
                    </h3>
                    <div className="space-y-1">
                        {costByDay.map((item) => (
                            <div key={item.date} className="space-y-0.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        {item.date}
                                    </span>
                                    <span>{formatCost(item.total_cost)}</span>
                                </div>
                                <CostBar
                                    value={item.total_cost}
                                    max={maxDayCost}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
