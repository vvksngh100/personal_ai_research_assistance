import Validator from "validatorjs";

const validator = (data, rules, customMessage) => {
    return new Validator(data, rules, customMessage);
}

export default validator;