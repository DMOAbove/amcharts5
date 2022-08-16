import type { TimeUnit } from "../../../core/util/Time"
import type { DateAxis } from "../../xy/axes/DateAxis";
import type { AxisRenderer } from "../../xy/axes/AxisRenderer";

import { StockControl, IStockControlSettings, IStockControlPrivate, IStockControlEvents } from "./StockControl";
import { MultiDisposer, IDisposer } from "../../../core/util/Disposer";

import * as $utils from "../../../core/util/Utils";
import * as $time from "../../../core/util/Time";
import * as $array from "../../../core/util/Array";

export interface IPeriod {
	timeUnit: TimeUnit | "ytd" | "max";
	count?: number;
	name?: string;
}

export interface IPeriodSelectorSettings extends IStockControlSettings {

	/**
	 * A list periods to choose from.
	 */
	periods?: IPeriod[];

}

export interface IPeriodSelectorPrivate extends IStockControlPrivate {

	/**
	 * @ignore
	 */
	axis?: DateAxis<AxisRenderer>;

	/**
	 * @ignore
	 */
	deferReset?: boolean;

	/**
	 * @ignore
	 */
	deferTimeout?: IDisposer;

}

export interface IPeriodSelectorEvents extends IStockControlEvents {
}

/**
 * A pre-defined period selector control for [[StockToolback]].
 *
 * @see {@link https://www.amcharts.com/docs/v5/charts/stock/toolbar/period-selector/} for more info
 */
export class PeriodSelector extends StockControl {
	public static className: string = "PeriodSelector";
	public static classNames: Array<string> = StockControl.classNames.concat([PeriodSelector.className]);

	declare public _settings: IPeriodSelectorSettings;
	declare public _privateSettings: IPeriodSelectorPrivate;
	declare public _events: IPeriodSelectorEvents;

	protected _afterNew() {
		super._afterNew();

		const button = this.getPrivate("button")!;
		button.className = button.className + " am5stock-no-hover";

		this._initPeriodButtons();
	}

	protected _initPeriodButtons(): void {
		const container = this.getPrivate("label")!;
		container.style.display = "";

		const periods = this.get("periods", []);
		$array.each(periods, (period) => {
			const button = document.createElement("a");
			button.innerHTML = period.name || (period.timeUnit.toUpperCase() + period.count || "1");
			button.className = "am5stock-link";
			container.appendChild(button);

			this._disposers.push($utils.addEventListener(button, "click", (_ev) => {
				this.setPrivate("deferReset", false);
				this._resetActiveButtons();
				this.selectPeriod(period);
				this.setPrivate("deferReset", true);
				$utils.addClass(button, "am5stock-active");
				const timeout = this.getPrivate("deferTimeout");
				if (timeout) {
					timeout.dispose();
				}
				const axis = this._getAxis();
				this.setPrivate("deferTimeout", this.setTimeout(() => this.setPrivate("deferReset", false), axis.get("interpolationDuration", 1000) + 200));
			}));
		});

	}

	protected _resetActiveButtons(): void {
		if (this.getPrivate("deferReset") !== true) {
			const container = this.getPrivate("label")!;
			const buttons = container.getElementsByClassName("am5stock-active");
			$array.each(buttons, (b) => {
				$utils.removeClass(<HTMLElement>b, "am5stock-active");
			});

			let axis = this.getPrivate("axis");
			if (!axis) {
				axis = this._getAxis();
				this.setPrivate("axis", axis);
				this._disposers.push(new MultiDisposer([
					axis!.on("start", () => this._resetActiveButtons()),
					axis!.on("end", () => this._resetActiveButtons())
				]));
			}
		}
	}

	// protected _getDefaultIcon(): SVGElement {
	// 	return StockIcons.getIcon("Period");
	// }

	public _afterChanged() {
		super._afterChanged();
		// if (this.isDirty("active")) {
		// 	this._initDropdown();
		// }
	}

	protected _getChart(): any {
		return this.get("stockChart").panels.getIndex(0)!;
	}

	protected _getAxis(): any {
		return this._getChart().xAxes.getIndex(0)!;
	}

	public selectPeriod(period: IPeriod): void {
		if (period.timeUnit == "max") {
			this._getChart().zoomOut();
		}
		else {
			const axis = this._getAxis();
			let end = new Date(axis.getPrivate("max"));
			let start: Date;
			if (period.timeUnit == "ytd") {
				start = new Date(end.getFullYear(), 0, 1, 0, 0, 0, 0);
				end = new Date(axis.getIntervalMax(axis.get("baseInterval")));
				if (axis.get("groupData")) {
					axis.zoomToDates(start, end, 0);
					setTimeout(() => {
						axis.zoomToDates(start, end, 0);
					}, 10);

					return;
				}
			}
			else {
				// some adjustments in case data is grouped
				if (axis.get("groupData")) {
					// find interval which will be used after zoom
					const interval = axis.getGroupInterval($time.getDuration(period.timeUnit, period.count))
					if (interval) {
						// find max of the base interval
						let endTime = axis.getIntervalMax(axis.get("baseInterval"));

						if (endTime != null) {
							// round to the future interval
							end = $time.round(new Date(endTime), interval.timeUnit, interval.count);
						}

						start = $time.add(new Date(end), period.timeUnit, (period.count || 1) * -1);
						axis.zoomToDates(start, end, 0);
						setTimeout(() => {
							axis.zoomToDates(start, end, 0);
						}, 10);

						return;
					}
				}

				start = $time.add(new Date(end), period.timeUnit, (period.count || 1) * -1);
			}
			axis.zoomToDates(start, end);
		}
	}

}