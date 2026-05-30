export type Id = string;

export interface OrderItem {
  productId: Id;
  quantity: number | string;
  note?: string;
  notes?: string;
  modifiers?: string[];
}

export interface Product {
  id: Id;
  name?: string;
  price?: number;
  active?: boolean;
  recipe?: RecipeLine[];
  availability?: Record<string, boolean>;
  targetMargin?: number;
  minMargin?: number;
}

export interface Ingredient {
  id: Id;
  name?: string;
  stock?: number;
  active?: boolean;
  unit?: string;
  unitType?: string;
}

export interface RecipeLine {
  ingredientId: Id;
  grams?: number;
  milliliters?: number;
  units?: number;
  wastePercent?: number;
  appliesTo?: string;
}

export interface OrderContext {
  channel: string;
  fulfillment: string;
}

export interface Reservation {
  id?: Id;
  tableId?: Id;
  guests?: number;
  time?: string;
  status?: string;
  name?: string;
}
