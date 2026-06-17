function createAgencyRateLabelPlugin(pluginId) {
  return {
    id: pluginId,
    afterDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      if (!meta?.data?.length) return;

      const { ctx, chartArea, scales } = chart;
      const rows = chart.$agencyTooltipRows ?? [];
      const xScale = scales.x;
      const axisMax = typeof xScale?.max === "number" ? xScale.max : 100;
      const padding = 6;

      ctx.save();
      ctx.font = 'bold 11px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        const rate = rows[index]?.rate ?? chart.data.datasets[0]?.data[index];
        if (rate == null || Number.isNaN(rate)) return;

        const label = `${rate}%`;
        const { x, y, base } = bar.getProps(["x", "y", "base"], true);
        const barLeft = Math.min(x, base);
        const barRight = Math.max(x, base);
        const textWidth = ctx.measureText(label).width;

        let labelX;
        let textAlign;
        let fillStyle = "#ffffff";

        if (rate > axisMax && xScale && chartArea) {
          labelX = xScale.getPixelForValue(axisMax) - padding;
          textAlign = "right";
          const visibleWidth = labelX + padding - barLeft;
          if (visibleWidth < textWidth + padding * 2) {
            labelX = Math.min(xScale.getPixelForValue(axisMax) + padding, chartArea.right - 2);
            textAlign = "left";
            fillStyle = "#374151";
          }
        } else {
          const barWidth = barRight - barLeft;
          if (barWidth >= textWidth + padding * 2) {
            labelX = barRight - padding;
            textAlign = "right";
          } else {
            labelX = Math.min(barRight + padding, chartArea?.right ? chartArea.right - 2 : barRight + padding);
            textAlign = "left";
            fillStyle = "#374151";
          }
        }

        ctx.fillStyle = fillStyle;
        ctx.textAlign = textAlign;
        ctx.fillText(label, labelX, y);
      });

      ctx.restore();
    },
  };
}
