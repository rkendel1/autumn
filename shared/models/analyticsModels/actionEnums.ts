export enum AuthType {
	SecretKey = "secret_key",
	PublicKey = "public_key",
	Dashboard = "dashboard",
	Stripe = "stripe",
	Unknown = "unknown",
}

export enum ActionType {
	CustomerCreated = "customer.created",
	CustomerProductsUpdated = "customer.products.updated",
	CustomerFeaturesUpdated = "customer.features.updated",
}
