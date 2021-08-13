import type { DataItem } from "../../core/render/Component";
import type { PieChart } from "./PieChart";
import { PercentSeries, IPercentSeriesSettings, IPercentSeriesDataItem, IPercentSeriesPrivate } from "../percent/PercentSeries";
import type { Root } from "../../core/Root";
import { Template } from "../../core/util/Template";
import { Slice } from "../../core/render/Slice";
import { Tick } from "../../core/render/Tick";
import { RadialLabel } from "../../core/render/RadialLabel";
import { ListTemplate } from "../../core/util/List";
import * as $array from "../../core/util/Array";
import * as $math from "../../core/util/Math";
import * as $utils from "../../core/util/Utils";
import { p100, Percent } from "../../core/util/Percent";

export interface IPieSeriesDataItem extends IPercentSeriesDataItem {
	slice: Slice;
	label: RadialLabel;
	tick: Tick;
}

export interface IPieSeriesSettings extends IPercentSeriesSettings {

	/**
	 * Radius of the series in pixels or percent.
	 */
	radius?: Percent | number;

	/**
	 * Radius of the series in pixels or percent.
	 */
	innerRadius?: Percent | number;

	/**
	 * Start angle of the series in degrees.
	 *
	 * @default -90
	 */
	startAngle?: number;

	/**
	 * End angle of the series in degrees.
	 *
	 * @default 270
	 */
	endAngle?: number;

}

export interface IPieSeriesPrivate extends IPercentSeriesPrivate {
}

/**
 * Creates a series for a [[PieChart]].
 *
 * @see {@link https://www.amcharts.com/docs/v5/getting-started/percent-charts/pie-chart/} for more info
 * @important
 */
export class PieSeries extends PercentSeries {

	declare public chart: PieChart | undefined;

	/**
	 * Use this method to create an instance of this class.
	 *
	 * @see {@link https://www.amcharts.com/docs/v5/getting-started/#New_element_syntax} for more info
	 * @param   root      Root element
	 * @param   settings  Settings
	 * @param   template  Template
	 * @return            Instantiated object
	 */
	public static new(root: Root, settings: PieSeries["_settings"], template?: Template<PieSeries>): PieSeries {
		const x = new PieSeries(root, settings, true, template);
		x._afterNew();
		return x;
	}

	public static className: string = "PieSeries";
	public static classNames: Array<string> = PercentSeries.classNames.concat([PieSeries.className]);

	declare public _settings: IPieSeriesSettings;
	declare public _privateSettings: IPieSeriesPrivate;
	declare public _dataItemSettings: IPieSeriesDataItem;

	declare public _sliceType: Slice;
	declare public _labelType: RadialLabel;
	declare public _tickType: Tick;

	protected _makeSlices(): ListTemplate<this["_sliceType"]> {
		return new ListTemplate(
			Template.new({}),
			() => Slice.new(this._root, {
				themeTags: $utils.mergeTags(this.slices.template.get("themeTags", []), ["pie", "series"])
			}, this.slices.template),
		);
	}

	protected _makeLabels(): ListTemplate<this["_labelType"]> {
		return new ListTemplate(
			Template.new({}),
			() => RadialLabel.new(this._root, {
				themeTags: $utils.mergeTags(this.slices.template.get("themeTags", []), ["pie", "series"])
			}, this.labels.template),
		);
	}

	protected _makeTicks(): ListTemplate<this["_tickType"]> {
		return new ListTemplate(
			Template.new({}),
			() => Tick.new(this._root, {
				themeTags: $utils.mergeTags(this.slices.template.get("themeTags", []), ["pie", "series"])
			}, this.ticks.template),
		);
	}

	protected processDataItem(dataItem: DataItem<this["_dataItemSettings"]>) {
		super.processDataItem(dataItem);

		const slice = this.makeSlice(dataItem);

		slice.on("scale", () => {
			this._updateTick(dataItem);
		})
		slice.on("shiftRadius", () => {
			this._updateTick(dataItem);
		})
		slice.events.on("positionchanged", () => {
			this._updateTick(dataItem);
		})

		const label = this.makeLabel(dataItem);

		label.events.on("positionchanged", () => {
			this._updateTick(dataItem);
		})

		this.makeTick(dataItem);

		slice.events.on("positionchanged", () => {
			label.markDirty();
		})
	}

	protected _getNextUp() {
		return this.labelsContainer.maxHeight() / 2;
	}

	protected _getNextDown() {
		return -this.labelsContainer.maxHeight() / 2;
	}

	public _prepareChildren() {
		super._prepareChildren();
		const chart = this.chart;
		if (chart) {
			if (this._valuesDirty || this.isDirty("radius") || this.isDirty("innerRadius") || this.isDirty("startAngle") || this.isDirty("endAngle") || this.isDirty("alignLabels")) {
				this.markDirtyBounds();
				const startAngle = this.get("startAngle", chart.get("startAngle", -90));
				const endAngle = this.get("endAngle", chart.get("endAngle", 270));
				const arc = endAngle - startAngle;
				let currentAngle = startAngle;

				const radius = chart.radius(this);
				const innerRadius = chart.innerRadius(this) * chart.getPrivate("irModifyer", 1);

				if (radius > 0) {
					const colors = this.get("colors")!;
					colors.reset();
					$array.each(this._dataItems, (dataItem) => {

						this.updateLegendValue(dataItem);

						let currentArc = arc * dataItem.get("valuePercentTotal") / 100;
						const slice = dataItem.get("slice");
						if (slice) {
							slice.set("radius", radius);
							slice.set("innerRadius", innerRadius);
							slice.set("startAngle", currentAngle);

							slice.set("arc", currentArc);
							slice.set("fill", colors.next());

							if (slice.get("stroke") == null) {
								slice.setRaw("stroke", slice.get("fill")); // setRaw for the userProperty not to be saved
							}
						}

						let middleAngle = $math.normalizeAngle(currentAngle + currentArc / 2);

						const label = dataItem.get("label");
						if (label) {

							if (this.get("alignLabels")) {
								label.set("textType", "aligned");
							}
							else {
								label.set("textType", "adjusted");
							}

							label.set("baseRadius", radius);
							label.set("labelAngle", middleAngle);

							if (label.get("textType") == "aligned") {
								let labelRadius = radius + label.get("radius", 0);
								let y = radius * $math.sin(middleAngle);

								if (middleAngle > 90 && middleAngle <= 270) {
									if (!label.isHidden() && !label.isHiding()) {
										this._lLabels.push({ label: label, y: y });
									}
									labelRadius *= -1;
									labelRadius -= this.labelsContainer.get("paddingLeft", 0);
									label.set("centerX", p100);
									label.setPrivateRaw("left", true);
								}
								else {
									if (!label.isHidden() && !label.isHiding()) {
										this._rLabels.push({ label: label, y: y });
									}
									labelRadius += this.labelsContainer.get("paddingRight", 0);
									label.set("centerX", 0);
									label.setPrivateRaw("left", false);
								}
								label.set("x", labelRadius);
								label.set("y", radius * $math.sin(middleAngle));
							}
						}
						currentAngle += currentArc;
					})
				}
			}
		}

	}

	protected _updateTick(dataItem: DataItem<this["_dataItemSettings"]>) {
		const tick = dataItem.get("tick");
		const label = dataItem.get("label");
		const slice = dataItem.get("slice");
		const location = tick.get("location", 1);
		if (tick && label && slice) {
			const radius = (slice.get("shiftRadius", 0) + slice.get("radius", 0)) * slice.get("scale", 1) * location;
			const labelAngle = label.get("labelAngle", 0);
			const cos = $math.cos(labelAngle);
			const sin = $math.sin(labelAngle);

			const labelsContainer = this.labelsContainer;
			const pl = labelsContainer.get("paddingLeft", 0);
			const pr = labelsContainer.get("paddingRight", 0);

			let x = 0;
			let y = 0;

			x = label.x();
			y = label.y();

			let dx = -pr;
			if (label.getPrivate("left")) {
				dx = pl;
			}

			tick.set("points", [{ x: slice.x() + radius * cos, y: slice.y() + radius * sin }, { x: x + dx, y: y }, { x: x, y: y }]);
		}
	}
}