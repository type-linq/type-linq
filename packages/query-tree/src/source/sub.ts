import { Expression } from '../expression.js';
import { EntityIdentifier, EntityType } from '../index.js';
import { randString } from '../util.js';
import { Source } from './source.js';

// TODO: Will we actually use this?

export class SubSource extends Source {
    readonly entity: EntityIdentifier;
    readonly identifier: string;

    /** Gets the underlying source */
    get source() {
        return super.source!;
    }
    
    /**
     * SubSource source may be mutated since it would usually be treated
     * as a sub expression, and as such needs to have the ability be processed,
     * separately, but have it's representation updated everywhere it appears
     * in the tree without needing complex search and equality code
     */
    set source(value: Source) {
        super.source = value;
    }

    get fieldSet() {
        return this.source.fieldSet;
    }

    constructor(source: Source, identifier = randString()) {
        super(source);
        this.identifier = identifier;
        this.entity = new EntityIdentifier(
            identifier,
            source.type as EntityType,
        );
    }

    isEqual(expression?: Expression | undefined): boolean {
        if (expression === this) {
            return true;
        }

        if (expression instanceof SubSource === false) {
            return false;
        }
        // No complicated comparison.
        return this.identifier === expression.identifier;
    }

    rebuild(source: Source | undefined): Expression {
        return new SubSource(source ?? this.source, this.identifier);
    }

    /** A SubSource is not intended to be walked directly */
    *walk() { }
}

