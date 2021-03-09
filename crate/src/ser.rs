use crate::op;
use jomini::{ArrayReader, Encoding, ObjectReader, Operator, TextTape, TextToken, ValueReader};
use serde::{
    ser::{SerializeMap, SerializeSeq},
    Serialize, Serializer,
};
use std::{cell::RefCell, ops::Deref};

fn serialize_scalar<E, S>(reader: &ValueReader<E>, s: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
    E: Encoding + Clone,
{
    let scalar = reader.read_scalar().unwrap();
    if let Ok(x) = scalar.to_bool() {
        return s.serialize_bool(x);
    }

    let signed = scalar.to_i64();
    let unsigned = scalar.to_u64();
    let float = scalar.to_f64();

    // We only want to serialize numbers that are perfectly representable
    // with 64 bit floating point, else the value will be stringified
    match (signed, unsigned, float) {
        (Ok(x), _, Ok(_)) => s.serialize_i64(x),
        (_, Ok(x), Ok(_)) => s.serialize_u64(x),
        (_, _, Ok(f)) => s.serialize_f64(f),
        _ => s.serialize_str(reader.read_str().unwrap().deref()),
    }
}

pub(crate) struct SerValue<'data, 'tokens, 'reader, E> {
    reader: &'reader ValueReader<'data, 'tokens, E>,
}

impl<'data, 'tokens, 'reader, E> Serialize for SerValue<'data, 'tokens, 'reader, E>
where
    E: Encoding + Clone,
{
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self.reader.token() {
            TextToken::Quoted(_) | TextToken::Unquoted(_) => {
                serialize_scalar(&self.reader, serializer)
            }
            TextToken::Array(_) => {
                let array_reader = self.reader.read_array().unwrap();
                let seq = SerArray {
                    reader: RefCell::new(array_reader),
                };
                seq.serialize(serializer)
            }
            TextToken::Object(_) | TextToken::HiddenObject(_) => {
                let object_reader = self.reader.read_object().unwrap();
                let map = SerTape {
                    reader: RefCell::new(object_reader),
                };
                map.serialize(serializer)
            }
            TextToken::Header(_) => {
                let mut arr = self.reader.read_array().unwrap();
                let key_reader = arr.next_value().unwrap();
                let value_reader = arr.next_value().unwrap();

                let mut map = serializer.serialize_map(None)?;
                map.serialize_entry(
                    &key_reader.read_str().unwrap(),
                    &SerValue {
                        reader: &value_reader,
                    },
                )?;
                map.end()
            }
            TextToken::End(_) | TextToken::Operator(_) => serializer.serialize_none(),
        }
    }
}

pub(crate) struct SerTape<'data, 'tokens, E> {
    reader: RefCell<ObjectReader<'data, 'tokens, E>>,
}

impl<'data, 'tokens, E> SerTape<'data, 'tokens, E>
where
    E: Encoding + Clone,
{
    pub fn new(tape: &'tokens TextTape<'data>, encoding: E) -> Self {
        SerTape {
            reader: RefCell::new(ObjectReader::new(tape, encoding)),
        }
    }
}

impl<'data, 'tokens, E> Serialize for SerTape<'data, 'tokens, E>
where
    E: Encoding + Clone,
{
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut reader = self.reader.borrow_mut();
        let mut map = serializer.serialize_map(None)?;
        while let Some((key, mut entries)) = reader.next_fields() {
            if entries.len() == 1 {
                let (op, val) = entries.pop().unwrap();
                let v = OperatorValue {
                    operator: op,
                    value: val,
                };

                map.serialize_entry(&key.read_str(), &v)?;
            } else {
                let values: Vec<_> = entries
                    .into_iter()
                    .map(|(op, val)| OperatorValue {
                        operator: op,
                        value: val,
                    })
                    .collect();
                map.serialize_entry(&key.read_str(), &values)?;
            }
        }

        map.end()
    }
}

pub(crate) struct OperatorValue<'data, 'tokens, E> {
    operator: Option<Operator>,
    value: ValueReader<'data, 'tokens, E>,
}

impl<'data, 'tokens, E> Serialize for OperatorValue<'data, 'tokens, E>
where
    E: Encoding + Clone,
{
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        if let Some(op) = self.operator {
            let mut map = serializer.serialize_map(None)?;
            let reader = &self.value;
            map.serialize_entry(op::operator_name(op), &SerValue { reader })?;
            map.end()
        } else {
            let reader = &self.value;
            let vs = SerValue { reader };
            vs.serialize(serializer)
        }
    }
}

pub(crate) struct SerArray<'data, 'tokens, E> {
    reader: RefCell<ArrayReader<'data, 'tokens, E>>,
}

impl<'data, 'tokens, E> Serialize for SerArray<'data, 'tokens, E>
where
    E: Encoding + Clone,
{
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut reader = self.reader.borrow_mut();
        let mut seq = serializer.serialize_seq(None)?;
        while let Some(value) = reader.next_value() {
            let v = OperatorValue {
                operator: None,
                value,
            };
            seq.serialize_element(&v)?;
        }

        seq.end()
    }
}
