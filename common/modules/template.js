var EXPORTED_SYMBOLS = ["convert"];
const Cu = Components.utils;

gDebugOutput = false;
var scope = {};
Cu.import("resource://gre/modules/Services.jsm", scope);

function convert(str, debug) {
    //xxx: ignore debug action
    //var $$;
    gDebugOutput = !!debug;

    function fnRawEscape(str) {
        return ({
            "\n":   "\\n\\\n",
            "\r\n": "\\n\\\n",
            "\r":   "\\n\\\n",
            '"':    '\\"',
            "\\":   '\\\\',
        })[str];
    }
    const reRawEscape = /\r\n?|\n|"|\\/g;

    //const TEMPLATE = {}, TEMPLATE_PORTION = {}, SQUARE = {}, ROUND = {}, CURLY = {}, ROUND1 = {}, ROOT = {};
    const TEMPLATE = {s:"t"}, TEMPLATE_PORTION = {s: "tp"}, SQUARE = {s: "s["}, ROUND = {s:"s("}, CURLY = {s:"s{"}, ROUND1 = {s:"fn"}, ROOT = {s:"r"};
    const TYPE = 0, HAS_HANDLER = 1, RESULT = 2, RAW = 3, SUBSTITUDE = 4;
    var c, c0, c1, m, q_str, i, j;
    var start = 0, offset = 0;
    var isOp = false;
    var whiteSpace = /^\s*/y;
    var op = "!\"#%&'()=-~^\\`@+;*:{[}]<>,?/";
    var idToken = new RegExp("^[^\\" + op.split("").join("\\") + "\\s]+", "y");
    var funcToken = /^(?:\s+[^\(]*\s*)?\(/y;
    var attrFn = /^\s*:/y;
    var expressionToken = /^\s*\(/y;
    var reOpt = /^[igmy]*/y;
    var reEach = /^\s+each/y;
    var last = str.length;
    var stack = [];
    const BackSlash  = '\\';
    var RET = '\r';
    var NL  = '\n';
    var BQ  = '`';
    var $ = '$';
    var re;
    var depth = 0;
    var state = [ROOT, null]; //xxx:
    var raw, substitude, args, hasHandler, cooked;
    res = "";
    root_loop: while (offset < last) {
        // white space
        whiteSpace.lastIndex = offset;
        m = whiteSpace.exec(str);
        if (!m) break;
        offset = whiteSpace.lastIndex;
        c = str[offset++];
        if (!c) break;

        //xxx: goto
        goto_switch: while (1) {
        switch (c) {
        case "/":
            c0 = str[offset];
            if (c0 === "/") {
                offset++;
                while (c0 = str[offset++]) {
                    if (c0 === NL)
                        continue root_loop;
                    else if (c0 === RET) {
                        if (str[offset] === NL) offset++;
                        continue root_loop;
                    }
                }
                break root_loop;
            } else if (c0 === "*") {
                offset++;
                while (c0 = str[offset++]) {
                    if (c0 === "*" && str[offset] === "/") {
                        offset++;
                        continue root_loop;
                    }
                }
                break root_loop;
            // xxx: 
            } else if (c0 === "=") {
                offset++;
                isOp = false;
            } else if (isOp) {
                isOp = false;
            } else {
                // RegExp Literal
                var x = offset;
                while (c0 = str[offset++]) {
                    if (c0 === "\\") {
                        offset++;
                    //} else if (c0 === NL || c0 === RET) {
                    //    break root_loop;
                    } else if (c0 === "/") {
                        reOpt.lastIndex = offset;
                        m = reOpt.exec(str);
                        offset = reOpt.lastIndex;
                        break;
                    } else if (c0 === "[") {
                        while (c1 = str[offset++]) {
                            if (c1 === "\\") offset++;
                            else if (c1 === "]") {
                                break;
                            }
                        }
                    }
                }
                isOp = true;
            }
            break;
        case "`":
            res += str.substring(start, offset - 1);
            start = offset;

            stack[depth++] = state;
            state = [TEMPLATE, isOp, res, [], []];
            res = "";
            //c = TEMPLATE_PORTION;
            //continue goto_switch;
            //break;
        case TEMPLATE_PORTION:
            start = offset;
            q_str = "";
            while (c0 = str[offset++]) {
                if (c0 === "\\") offset++;
                else if (c0 === "`") {
                    // end quansi literal
                    res = state[RESULT];
                    hasHandler = state[HAS_HANDLER];
                    args = state[RAW];
                    substitude = state[SUBSTITUDE];

                    args[args.length] = q_str + str.substring(start, offset -1);


                    if (hasHandler) {
                        raw = args;

                        //xxx: cooked is not implement
                        cooked = [];
                        for (i = 0, j = raw.length; i < j; i++) {
                            cooked[i] = raw[i].replace(/(\\*)([\r\n]+|")/g, function (str, bs, c) {
                                var n = bs.length;
                                if (n % 2) {
                                    if (c !== '"') str = bs.substr(1);
                                } else {
                                    if (c === '"') str = "\\" + str;
                                    else {
                                        str = bs;
                                    }
                                }
                                return str;
                            });
                            raw[i] = raw[i].replace(reRawEscape, fnRawEscape);
                        }

                        substitude = substitude.length ? "(" + substitude.join("), (") + ")" : "";
                        res +=
'({\
raw: ["' + raw.join('", "') + '"],\
cooked: ["' + cooked.join('", "') + '"]' +
'}, [' + substitude + '])';

                    } else {
                        // default handler
                        if (args.length === 1) {
                            res += '"' + args[0].replace(reRawEscape, fnRawEscape) + '"';
                        } else {
                            res += '("' + args[0].replace(reRawEscape, fnRawEscape) + '"';
                            for (i = 0, j = substitude.length; i < j; i++) {
                                res += ' + (' + substitude[i] + ') + "' + args[i + 1].replace(reRawEscape, fnRawEscape) + '"';
                            }
                            res += ")";
                        }
                    }
                    //end flush
                    state = stack[--depth];
                    start = offset;
                    isOp = true;
                    continue root_loop;
                } else if (c0 === $) {
                    c1 = str[offset];

                    // close TemplateLiteralPortion
                    if (c1 === "{") // c1 === "{"
                    {
                        var args = state[RAW];
                        args[args.length] = q_str + str.substring(start, offset -1);
                        offset++;
                        start = offset;
                        isOp = false;
                        continue root_loop;
                    }
                }
            }
            break;
        case "'": case '"':
            //string literal
            for (c0 = str[offset++]; offset < last && c0 !== c; c0 = str[offset++]) {
                if (c0 === BackSlash) offset++;
            }
            isOp = true;
            break;
        case ";":
            isOp = false;
            break;
        case ":": case "+": case "-": case "*": case "=": case ",":
        case "!": case "|": case "&": case ">": case "%": case "~":
        case "^": case "<": case "?": case ";":
            isOp = false;
            break;
        case "(":
            stack[depth++] = state;
            state = [ROUND, offset];
            isOp = false;
            break;
        case ")":
            switch (state[TYPE]) {
            case ROUND:
                state = stack[--depth];
                isOp = true;
                break;
            case ROUND1:
                state = stack[--depth];
                isOp = false;
                break;
            default:
                break root_loop;
                throw SynstaxError("MissMatch:)");
                break;
            }
            break;
        case "{":
            stack[depth++] = state;
            state = [CURLY, null, offset];
            isOp = false;
            break;
        case "}":
            switch (state[TYPE]) {
            // Template's Substitution
            case TEMPLATE:
                args = state[SUBSTITUDE];
                args[args.length] = res + str.substring(start, offset - 1);
                res = "";
                c = TEMPLATE_PORTION;
                start = offset;
                continue goto_switch;
            case CURLY:
                state = stack[--depth];
                isOp = false;
                break;
            default:
                break root_loop;
                throw SynstaxError("MissMatch:}");
            }
            break;
        case "[":
            stack[depth++] = state;
            state = [SQUARE, null];
            isOp = false;
            break;
        case "]":
            if (state[0] === SQUARE) {
                state = stack[--depth];
                isOp = true;
            //xxx: error
            } else { break root_loop; } //throw SyntaxError();
            break;
        default:

            //xxx: e4x attribute
            if (c === "@" && str[offset - 2] === ".") {
                if (str[offset++] === "*") {
                    break;
                }
            }
            idToken.lastIndex = offset - 1;
            m = idToken.exec(str);
            if(!m) break root_loop;
            word = m[0];

            // xxx: support for each
            if (word === "for") {
                reEach.lastIndex = idToken.lastIndex;
                m = reEach.exec(str);
                if (m) idToken.lastIndex = reEach.lastIndex;
            }

            if (word === "function") {
                funcToken.lastIndex = idToken.lastIndex;
                m = funcToken.exec(str);
                if (!m) {
                    //xxx: e4x "::"
                    if (str.substr(idToken.lastIndex, 2) === "::") {
                        idToken.lastIndex += 2;
                        m = idToken.exec(str);
                        if (m) {
                            offset = idToken.lastIndex;
                            break;
                        }
                    } else {
                        // var obj = { function: xxx}
                        attrFn.lastIndex = idToken.lastIndex;
                        m = attrFn.exec(str);
                        if (m) {
                            offset = attrFn.lastIndex;
                            isOp = false;
                            break;
                        }
                    }
                    break root_loop;
                }
                offset = funcToken.lastIndex;
                stack[depth++] = state;
                state = [ROUND1];
                isOp = false;
            } else if (word === "if"
                ||  word === "while"
                ||  word === "for"
            ) {
                expressionToken.lastIndex = idToken.lastIndex;
                m = expressionToken.exec(str);
                if (!m) break root_loop;
                offset = expressionToken.lastIndex;
                stack[depth++] = state;
                state = [ROUND1];
                isOp = false;
            } else if (
                    word === "delete"
                ||  word === "new"
                ||  word === "return"
                ||  word === "throw"
                ||  word === "yield"
                ||  word === "in"
                ||  word === "instanceof"
                ||  word === "case"
                ||  word === "typeof"
                ||  word === "var"
                ||  word === "const"
                ||  word === "void"
            ) {
                offset = idToken.lastIndex;
                isOp = false;
            } else if (word === "let") {
                expressionToken.lastIndex = idToken.lastIndex;
                m = expressionToken.exec(str);
                // let declaration
                if (!m) {
                    offset = idToken.lastIndex;
                    isOp = false;
                    break;
                }
                offset = expressionToken.lastIndex;
                stack[depth++] = state;
                state = [ROUND1];
                isOp = false;
            } else {
                offset = idToken.lastIndex;
                isOp = true;
            }
            break;
        }
        break; } // goto_switch: while (1)
    }
    if (depth > 0) {
        Cu.reportError([(str.substr(0, offset).match(/\r?\n/g)||[]).length + 1, str.substr(offset -16, 16).quote(), str.substr(offset, 16).quote()]);
        Cu.reportError(JSON.stringify(stack.slice(0, depth), null, 1));
        //throw SyntaxError("TemplateConvertError");
    }
    return res + str.substring(start);
}
