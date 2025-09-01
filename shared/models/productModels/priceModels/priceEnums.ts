export enum BillingInterval {
	OneOff = "one_off",
	Week = "week",
	Month = "month",
	Quarter = "quarter",
	SemiAnnual = "semi_annual",
	Year = "year",
}

export enum PriceType {
	Fixed = "fixed",
	Usage = "usage",
}

export enum BillingType {
	OneOff = "one_off",
	FixedCycle = "fixed_cycle",

	UsageBelowThreshold = "usage_below_threshold",
	UsageInAdvance = "usage_in_advance",
	UsageInArrear = "usage_in_arrear",
	InArrearProrated = "in_arrear_prorated",
}
