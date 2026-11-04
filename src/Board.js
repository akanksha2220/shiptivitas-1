import React from 'react';
import Dragula from 'dragula';
import 'dragula/dist/dragula.css';
import Swimlane from './Swimlane';
import './Board.css';

export default class Board extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      clients: {
        backlog: [],
        inProgress: [],
        complete: []
      },
      loading: true,
      saving: false,
      error: ''
    };

    this.swimlanes = {
      backlog: React.createRef(),
      inProgress: React.createRef(),
      complete: React.createRef()
    };

    this.busy = true;
    this.unmounted = false;
  }

  groupClients(clients) {
    const sorted = [...clients].sort(
      (a, b) => a.priority - b.priority || a.id - b.id
    );

    return {
      backlog: sorted.filter(card => card.status === 'backlog'),
      inProgress: sorted.filter(card => card.status === 'in-progress'),
      complete: sorted.filter(card => card.status === 'complete')
    };
  }

  async loadClients() {
    this.busy = true;
    this.setState({ loading: true, error: '' });

    try {
      const response = await fetch('/api/v1/clients');

      if (!response.ok) {
        throw new Error('Could not load cards. Check the backend server.');
      }

      const clients = await response.json();

      if (!this.unmounted) {
        this.setState({
          clients: this.groupClients(clients),
          loading: false
        });
      }
    } catch (error) {
      if (!this.unmounted) {
        this.setState({
          error: error.message,
          loading: false
        });
      }
    } finally {
      this.busy = false;
    }
  }

  componentDidMount() {
    const laneKeys = ['backlog', 'inProgress', 'complete'];

    const statuses = {
      backlog: 'backlog',
      inProgress: 'in-progress',
      complete: 'complete'
    };

    this.drake = Dragula(
      laneKeys.map(key => this.swimlanes[key].current),
      {
        revertOnSpill: true,
        moves: () => !this.busy && !this.state.error
      }
    );

    this.drake.on('drag', element => {
      this.originalNextSibling = element.nextSibling;
    });

    this.drake.on('drop', (element, target, source) => {
      if (!target) return;

      const id = element.getAttribute('data-id');
      const lane = laneKeys.find(
        key => this.swimlanes[key].current === target
      );

      // Read the dropped position before restoring React's DOM.
      const priority = Array.from(target.children)
        .indexOf(element) + 1;

      source.insertBefore(element, this.originalNextSibling);

      this.saveMovement(id, statuses[lane], priority);
    });

    this.loadClients();
  }

  async saveMovement(id, status, priority) {
    this.busy = true;
    this.setState({ saving: true, error: '' });

    try {
      const response = await fetch(`/api/v1/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, priority })
      });

      if (!response.ok) {
        throw new Error('Could not save the card movement.');
      }

      const clients = await response.json();

      if (!this.unmounted) {
        this.setState({
          clients: this.groupClients(clients),
          saving: false
        });
      }
    } catch (error) {
      if (!this.unmounted) {
        this.setState({
          saving: false,
          error: `${error.message} Reload cards before trying again.`
        });
      }
    } finally {
      this.busy = false;
    }
  }

  componentWillUnmount() {
    this.unmounted = true;

    if (this.drake) {
      this.drake.destroy();
    }
  }

  renderSwimlane(name, key) {
    return (
      <div className="col-md-4">
        <Swimlane
          name={name}
          clients={this.state.clients[key]}
          dragulaRef={this.swimlanes[key]}
        />
      </div>
    );
  }

  render() {
    return (
      <div className="Board">
        <div className="container-fluid">
          {this.state.loading && <p>Loading cards...</p>}
          {this.state.saving && <p>Saving movement...</p>}

          {this.state.error && (
            <div className="alert alert-danger" role="alert">
              {this.state.error}
              {' '}
              <button
                type="button"
                onClick={() => this.loadClients()}
                disabled={this.state.loading || this.state.saving}
              >
                Reload cards
              </button>
            </div>
          )}

          <div className="row">
            {this.renderSwimlane('Backlog', 'backlog')}
            {this.renderSwimlane('In Progress', 'inProgress')}
            {this.renderSwimlane('Complete', 'complete')}
          </div>
        </div>
      </div>
    );
  }
}