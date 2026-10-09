export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export const longDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
})

export const shortMonthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
})

export function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

export function formatDate(value: Date) {
  return dayFormatter.format(value)
}

export function formatLongDate(value: Date) {
  return longDayFormatter.format(value)
}

export function formatTime(value: Date) {
  return value.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
