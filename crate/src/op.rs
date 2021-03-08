use jomini::Operator;

pub fn operator_name(op: Operator) -> &'static str {
    match op {
        Operator::LessThan => "LESS_THAN",
        Operator::LessThanEqual => "LESS_THAN_EQUAL",
        Operator::GreaterThan => "GREATER_THAN",
        Operator::GreaterThanEqual => "GREATER_THAN_EQUAL",
    }
}
