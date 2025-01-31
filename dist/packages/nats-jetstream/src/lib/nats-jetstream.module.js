"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NatsJetstreamModule = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
let NatsJetstreamModule = (() => {
    let _classDecorators = [(0, common_1.Module)({
            controllers: [],
            providers: [],
            exports: [],
        })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var NatsJetstreamModule = _classThis = class {
    };
    tslib_1.__setFunctionName(_classThis, "NatsJetstreamModule");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        tslib_1.__esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        NatsJetstreamModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        tslib_1.__runInitializers(_classThis, _classExtraInitializers);
    })();
    return NatsJetstreamModule = _classThis;
})();
exports.NatsJetstreamModule = NatsJetstreamModule;
//# sourceMappingURL=nats-jetstream.module.js.map