import { BadGatewayException, CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { StandardResponseDto } from '../dto/standard-response.dto';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationInfoDto } from '../dto/pagination-info.dto';
import { RESPONSE_FEATURES, RESPONSE_PAGINATION_INFO_KEY, RESPONSE_TYPE, STANDARD_RESPONSE_FEATURES_KEY, STANDARD_RESPONSE_MESSAGE_KEY, STANDARD_RESPONSE_TYPE_KEY } from '../constants';

import { IStandardResponseModuleOptions } from '../interfaces/standard-response-module-options.interface';

const defaultOptions: IStandardResponseModuleOptions = {
  interceptAll: true
};

@Injectable()
export class StandardResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StandardResponseInterceptor.name);
  private responseType: RESPONSE_TYPE;
  private responseFeatures: RESPONSE_FEATURES[];
  private routeController: Type<any>;
  private routeHandler: Function;

  constructor(
    private reflector: Reflector,
    protected readonly options: IStandardResponseModuleOptions = {}
  ) {
    this.options = { ...defaultOptions, ...options };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.routeController = context.getClass();
    this.routeHandler = context.getHandler();

    this.responseType = this.reflector.getAllAndOverride(
      STANDARD_RESPONSE_TYPE_KEY,
      [ this.routeHandler, this.routeController ]
    );

    if (!this.responseType && !this.options.interceptAll) {
      return next.handle();
    }

    this.responseFeatures =
      this.reflector.getAllAndMerge(STANDARD_RESPONSE_FEATURES_KEY, [
        this.routeHandler,
        this.routeController
      ]) ?? [];

    return next.handle().pipe(
      map((data) => {
        if (data instanceof HttpException) {
          return data;
        }
        if (!this.isValidResponse(data)) {
          return new BadGatewayException();
        }
        return this.transformResponse(data);
      })
    );
  }

  isValidResponse(data) {
    if (typeof data === 'undefined') return false;
    if (typeof this.options.validateResponse === 'undefined') return true;
    if (typeof this.options.validateResponse !== 'function') return false;
    const isArray = Array.isArray(data);
    if (isArray) {
      if (data.some((value) => !this.options.validateResponse(value))) {
        this.logger.error(this.options.validationErrorMessage);
        return false;
      }
    }
    if (!isArray && !this.options.validateResponse(data)) {
      this.logger.error(this.options.validationErrorMessage);
      return false;
    }
    return true;
  }

  transformResponse(data) {
    let transformFunction;

    if (this.responseType === RESPONSE_TYPE.RAW) {
      transformFunction = (data) => data;
      return transformFunction(data);
    }

    const responseFields: Partial<StandardResponseDto<typeof data>> = {};

    responseFields.message = this.reflector.get<string>(
      STANDARD_RESPONSE_MESSAGE_KEY,
      this.routeHandler
    );

    if (this.responseFeatures.includes(RESPONSE_FEATURES.PAGINATION)) {
      const paginationInfo = this.reflector.get<PaginationInfoDto>(
        RESPONSE_PAGINATION_INFO_KEY,
        this.routeHandler
      );
      responseFields.pagination = paginationInfo;
    }


    transformFunction = (data) =>
      new StandardResponseDto({ ...responseFields, data });

    return transformFunction(data);
  }
}
